import test from "node:test";
import assert from "node:assert/strict";
import { createStore, maskPhone, formatInr, istParts, istIso } from "../server/store.js";

function signIn(store, email) {
  const challenge = store.login(email, "HealthWise#2026");
  const session = store.verifyMfa(challenge.challengeId, "246810");
  return store.sessionUser(session.token);
}

test("masks phone numbers and formats paise", () => {
  assert.equal(maskPhone("9845012345"), "98••••••45");
  assert.equal(formatInr(141600), "₹1,416.00");
});

test("shared phone lookup returns every matching profile", () => {
  const store = createStore();
  const user = signIn(store, "leela.reception@healthwise.local");
  const found = store.searchPatients(user, "9845012345", "br-kor");
  assert.equal(found.length, 2);
  assert.equal(found[0].phone, undefined);
  assert.equal(found[0].phoneMasked, "98••••••45");
  assert.notEqual(found[0].id, found[1].id);
});

test("branch admin cannot open another branch", () => {
  const store = createStore();
  const user = signIn(store, "arun.nair@healthwise.local");
  assert.throws(() => store.dashboard(user, "br-ind"), (err) => err.code === "FORBIDDEN");
  assert.throws(() => store.listInvoices(user, "br-ind"), (err) => err.code === "FORBIDDEN");
});

test("booking the same slot is rejected and a free slot is kept", () => {
  const store = createStore();
  const user = signIn(store, "leela.reception@healthwise.local");
  const existing = store.data.appointments.find((row) => row.id === "apt-ananya");
  assert.throws(
    () => store.book(user, { branchId: "br-kor", patientId: "pt-kabir", physioId: "ph-neha", serviceId: "svc-consult", start: existing.start }, "slot-1"),
    (err) => err.code === "SLOT_CONFLICT",
  );
});

test("starting a visit sets the physiotherapist in service and completion restores them", () => {
  const store = createStore();
  const user = signIn(store, "leela.reception@healthwise.local");
  store.startVisit(user, "apt-ananya");
  const during = store.dashboard(user, "br-kor").physios.find((p) => p.id === "ph-neha");
  assert.equal(during.liveStatus, "IN_SERVICE");
  store.completeVisit(user, "apt-ananya", "Gait improved. Continue home drills.");
  const after = store.dashboard(user, "br-kor").physios.find((p) => p.id === "ph-neha");
  assert.equal(after.liveStatus, "AVAILABLE");
});

test("posted invoice uses integer paise and cannot be billed twice", () => {
  const store = createStore();
  const user = signIn(store, "leela.reception@healthwise.local");
  store.startVisit(user, "apt-kabir");
  store.completeVisit(user, "apt-kabir", "Guardian present. Session tolerated well.");
  const body = { branchId: "br-kor", patientId: "pt-kabir", appointmentId: "apt-kabir", lines: [{ serviceId: "svc-consult", qty: 1 }], discountBps: 0 };
  const invoice = store.createInvoice(user, body, "inv-kabir");
  assert.equal(invoice.subtotalPaise, 80000);
  assert.equal(invoice.taxPaise, 14400);
  assert.equal(invoice.totalPaise, 94400);
  const replay = store.createInvoice(user, body, "inv-kabir");
  assert.equal(replay.id, invoice.id);
  assert.throws(() => store.createInvoice(user, body, "inv-kabir-2"), (err) => err.code === "ALREADY_BILLED");
  assert.throws(
    () => store.createInvoice(user, { ...body, appointmentId: null, discountBps: 1500 }, "inv-discount"),
    (err) => err.code === "DISCOUNT_CAP",
  );
});

test("phone reveal is audited and refused for a physiotherapist", () => {
  const store = createStore();
  const physio = signIn(store, "neha.kulkarni@healthwise.local");
  assert.throws(() => store.revealPhone(physio, "pt-ananya"), (err) => err.code === "FORBIDDEN");
  const staff = signIn(store, "leela.reception@healthwise.local");
  const revealed = store.revealPhone(staff, "pt-ananya");
  assert.equal(revealed.phone, "9845012345");
  assert.ok(store.data.audit.some((event) => event.action === "PHONE_REVEAL" && event.targetId === "pt-ananya"));
});

test("a branch admin can add a physiotherapist and a service only for their branch", () => {
  const store = createStore();
  const user = signIn(store, "arun.nair@healthwise.local");
  assert.throws(
    () => store.addPhysio(user, { name: "Dr. Out", email: "out@healthwise.local", specialty: "Neuro", branchId: "br-ind" }),
    (err) => err.code === "FORBIDDEN",
  );
  const created = store.addPhysio(user, { name: "Dr. In Branch", email: "in.physio@healthwise.local", specialty: "Neuro", branchId: "br-kor", engagement: "EMPLOYEE", experienceYears: 6 });
  assert.equal(store.data.physios.find((physio) => physio.id === created.physioId).branchId, "br-kor");
  const service = store.addService(user, { name: "Taping", durationMin: 15, priceRupees: 500, applyAll: true });
  assert.equal(store.data.prices[`br-kor:${service.id}`], 50000);
  assert.equal(store.data.prices[`br-ind:${service.id}`], undefined);
});

test("reception can update a physiotherapy chart and a physio cannot change contact details", () => {
  const store = createStore();
  const reception = signIn(store, "leela.reception@healthwise.local");
  const updated = store.updatePatient(reception, "pt-ananya", { condition: "Cervical pain", painScore: 3, email: "ananya.updated@example.com" });
  assert.equal(updated.patient.condition, "Cervical pain");
  assert.equal(updated.patient.painScore, 3);
  assert.equal(updated.patient.email, "ananya.updated@example.com");
  const physio = signIn(store, "neha.kulkarni@healthwise.local");
  const clinical = store.updatePatient(physio, "pt-ananya", { affectedArea: "Neck", email: "should-not-stick@example.com" });
  assert.equal(clinical.patient.affectedArea, "Neck");
  assert.equal(clinical.patient.email, "ananya.updated@example.com");
  assert.throws(
    () => store.updatePatient(physio, "pt-ananya", { painScore: 11 }),
    (err) => err.code === "VALIDATION",
  );
});

test("organization admin can open a branch and a branch admin only sees assigned branches", () => {
  const store = createStore();
  const org = signIn(store, "priya.shah@healthwise.local");
  const created = store.addBranch(org, { name: "Jayanagar", code: "BLR-JAY", city: "Bengaluru", hours: "09:00–18:00" });
  assert.equal(created.branch.id, "br-blrjay");
  assert.equal(store.bootstrap(org, created.branch.id).branches.some((branch) => branch.id === "br-blrjay"), true);
  assert.equal(store.data.prices[`br-blrjay:svc-consult`], store.data.prices["br-kor:svc-consult"]);
  const branchAdmin = signIn(store, "arun.nair@healthwise.local");
  assert.throws(() => store.addBranch(branchAdmin, { name: "Blocked", code: "BLR-NO", city: "Bengaluru" }), (err) => err.code === "FORBIDDEN");
  assert.throws(() => store.dashboard(branchAdmin, created.branch.id), (err) => err.code === "FORBIDDEN");
  assert.equal(store.listBranches(branchAdmin).branches.some((branch) => branch.id === "br-ind"), false);
  const leela = store.data.users.find((user) => user.email === "leela.reception@healthwise.local");
  const assigned = store.assignBranchAdmin(org, { userId: leela.id, branchIds: [created.branch.id] });
  assert.equal(assigned.role, "BRANCH_ADMIN");
  const manager = signIn(store, "leela.reception@healthwise.local");
  assert.deepEqual(store.bootstrap(manager, created.branch.id).branches.map((branch) => branch.id), [created.branch.id]);
  assert.throws(() => store.dashboard(manager, "br-kor"), (err) => err.code === "FORBIDDEN");
});

test("a patient calendar shows taken times without another patient's name", () => {
  const store = createStore();
  const patient = { role: "PATIENT", patientId: "pt-rohan", name: "Rohan Rao" };
  const from = new Date(Date.now() - 24 * 3600000).toISOString();
  const to = new Date(Date.now() + 24 * 3600000).toISOString();
  const board = store.availability(patient, { branchId: "br-kor", physioId: "ph-neha", from, to });
  assert.equal(board.busy.some((row) => row.mine), true);
  assert.equal(board.busy.some((row) => !row.mine), true);
  assert.equal(JSON.stringify(board).includes("Ananya"), false);
  const branchAdmin = signIn(store, "arun.nair@healthwise.local");
  assert.throws(() => store.availability(branchAdmin, { branchId: "br-ind", physioId: "ph-suresh", from, to }), (err) => err.code === "FORBIDDEN");
});

test("next week shows bookings, leave blocks a day, and hours stay with the right person", () => {
  const store = createStore();
  const nehaVisit = store.data.appointments.find((row) => row.id === "apt-next-ananya-neha");
  const sureshVisit = store.data.appointments.find((row) => row.id === "apt-next-ananya-suresh");
  assert.ok(nehaVisit && sureshVisit);
  assert.notEqual(nehaVisit.branchId, sureshVisit.branchId);
  assert.notEqual(nehaVisit.physioId, sureshVisit.physioId);
  const aisha = store.data.physios.find((physio) => physio.id === "ph-aisha");
  assert.ok(aisha.leave.length);
  const user = signIn(store, "leela.reception@healthwise.local");
  const parts = istParts(new Date(nehaVisit.start));
  assert.throws(
    () => store.book(user, { branchId: "br-kor", patientId: "pt-meera", physioId: "ph-neha", serviceId: "svc-consult", start: istIso(parts.year, parts.month, parts.day, 8, 0) }, "early-slot"),
    (err) => err.code === "OUTSIDE_HOURS",
  );
  const booked = store.book(user, { branchId: "br-kor", patientId: "pt-meera", physioId: "ph-neha", serviceId: "svc-consult", start: istIso(parts.year, parts.month, parts.day, 14, 0) }, "open-slot");
  assert.equal(booked.status, "BOOKED");
  const [year, month, day] = aisha.leave[0].from.split("-").map(Number);
  assert.throws(
    () => store.book(user, { branchId: "br-kor", patientId: "pt-fatima", physioId: "ph-aisha", serviceId: "svc-consult", start: istIso(year, month, day, 12, 0) }, "leave-slot"),
    (err) => err.code === "PHYSIO_ON_LEAVE",
  );
  const neha = signIn(store, "neha.kulkarni@healthwise.local");
  const updated = store.updateConsult(neha, "ph-neha", { days: [1, 2, 3, 4, 5], start: "10:00", end: "16:00", leave: [] });
  assert.deepEqual(updated.consult.days, [1, 2, 3, 4, 5]);
  assert.throws(
    () => store.updateConsult(neha, "ph-vikram", { days: [1], start: "10:00", end: "16:00", leave: [] }),
    (err) => err.code === "FORBIDDEN",
  );
  const branchAdmin = signIn(store, "arun.nair@healthwise.local");
  assert.throws(
    () => store.updateConsult(branchAdmin, "ph-suresh", { days: [1], start: "09:00", end: "17:00", leave: [] }),
    (err) => err.code === "FORBIDDEN",
  );
  const org = signIn(store, "priya.shah@healthwise.local");
  assert.equal(store.listAppointments(org, "br-ind").some((row) => row.id === "apt-next-fatima-suresh"), true);
  store.cancel(org, "apt-next-fatima-suresh", "CLINIC_REQUEST");
  assert.equal(store.data.appointments.find((row) => row.id === "apt-next-fatima-suresh").status, "CANCELLED");
});

test("a minor cannot be registered without guardian consent", () => {
  const store = createStore();
  const user = signIn(store, "leela.reception@healthwise.local");
  assert.throws(
    () => store.createPatient(user, { name: "New Child", phone: "9000000001", gender: "Male", dob: "2018-01-01", branchId: "br-kor", isMinor: true, guardianName: "Parent", guardianIdLast4: "1234", guardianConsent: false }),
    (err) => err.code === "VALIDATION",
  );
});

test("therapy duration, parallel capacity, and profile invoices stay consistent", () => {
  const store = createStore();
  const reception = signIn(store, "leela.reception@healthwise.local");
  const org = signIn(store, "priya.shah@healthwise.local");
  const physio = signIn(store, "neha.kulkarni@healthwise.local");
  const anchor = store.data.appointments.find((row) => row.id === "apt-next-ananya-neha");
  const parts = istParts(new Date(anchor.start));
  store.updateService(org, "svc-exercise", { minDurationMin: 15, durationStepMin: 15, maxDurationMin: 60 });
  assert.throws(
    () => store.book(reception, { branchId: "br-kor", patientId: "pt-fatima", physioId: "ph-neha", serviceId: "svc-exercise", durationMin: 20, start: istIso(parts.year, parts.month, parts.day, 12, 0) }, "bad-duration"),
    (err) => err.code === "DURATION",
  );
  const therapy = store.book(reception, { branchId: "br-kor", patientId: "pt-fatima", physioId: "ph-neha", serviceId: "svc-exercise", durationMin: 15, start: istIso(parts.year, parts.month, parts.day, 12, 0) }, "therapy-15");
  assert.equal(therapy.durationMin, 15);
  store.updateService(org, "svc-exercise", { minDurationMin: 30, durationStepMin: 30, maxDurationMin: 60 });
  assert.equal(store.data.appointments.find((row) => row.id === therapy.id).durationMin, 15);
  assert.throws(
    () => store.book(reception, { branchId: "br-kor", patientId: "pt-rohan", physioId: "ph-neha", serviceId: "svc-consult", start: istIso(parts.year, parts.month, parts.day, 12, 0) }, "consult-over-therapy"),
    (err) => err.code === "SLOT_CONFLICT",
  );
  const secondStart = istIso(parts.year, parts.month, parts.day, 14, 0);
  store.book(reception, { branchId: "br-kor", patientId: "pt-rohan", physioId: "ph-neha", serviceId: "svc-exercise", durationMin: 30, start: secondStart }, "therapy-a");
  assert.throws(
    () => store.book(reception, { branchId: "br-kor", patientId: "pt-meera", physioId: "ph-neha", serviceId: "svc-manual", start: secondStart }, "therapy-b"),
    (err) => err.code === "CAPACITY",
  );
  store.updateBookingConfig(org, { parallelTherapyCapacity: 2 });
  const parallel = store.book(reception, { branchId: "br-kor", patientId: "pt-meera", physioId: "ph-neha", serviceId: "svc-manual", start: secondStart }, "therapy-ok");
  store.cancel(reception, parallel.id, "CLINIC_REQUEST");
  store.book(reception, { branchId: "br-kor", patientId: "pt-kabir", physioId: "ph-neha", serviceId: "svc-manual", start: secondStart }, "after-cancel");
  assert.throws(
    () => store.book(reception, { branchId: "br-kor", patientId: "pt-ananya", physioId: "ph-neha", serviceId: "svc-consult", durationMin: 60, start: istIso(parts.year, parts.month, parts.day, 15, 0) }, "consult-two-slots"),
    (err) => err.code === "DURATION",
  );
  const doubled = store.book(reception, { branchId: "br-kor", patientId: "pt-ananya", physioId: "ph-neha", serviceId: "svc-manual", durationMin: 80, start: istIso(parts.year, parts.month, parts.day, 15, 0) }, "manual-two-slots");
  assert.equal(doubled.durationMin, 80);
  assert.equal(doubled.slotCount, 2);
  assert.throws(() => store.updateBookingConfig(signIn(store, "arun.nair@healthwise.local"), { parallelTherapyCapacity: 4 }), (err) => err.code === "FORBIDDEN");
  store.startVisit(reception, therapy.id);
  store.completeVisit(reception, therapy.id, "Exercise tolerated.");
  const invoice = store.createInvoice(reception, { branchId: "br-kor", patientId: "pt-fatima", appointmentIds: [therapy.id], transactionId: "UPI-1001" }, "inv-profile");
  assert.equal(invoice.transactionId, "UPI-1001");
  assert.equal(invoice.appointmentIds.length, 1);
  assert.throws(() => store.createInvoice(reception, { branchId: "br-kor", patientId: "pt-fatima", appointmentIds: [therapy.id] }, "inv-again"), (err) => err.code === "ALREADY_BILLED");
  assert.equal(store.updateInvoice(org, invoice.id, { transactionId: "UPI-1002" }).transactionId, "UPI-1002");
  assert.throws(() => store.createInvoice(physio, { branchId: "br-kor", patientId: "pt-fatima", lines: [{ serviceId: "svc-consult", qty: 1 }] }, "physio-invoice"), (err) => err.code === "FORBIDDEN");
});
