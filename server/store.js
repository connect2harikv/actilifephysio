import crypto from "node:crypto";
import fs from "node:fs";

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const GST_BPS = 1800;
const DISCOUNT_CAP_BPS = 1000;
const CANCEL_REASONS = ["PATIENT_REQUEST", "CLINIC_REQUEST", "PHYSIO_UNAVAILABLE", "OTHER"];
const RESCHEDULE_REASONS = ["PATIENT_REQUEST", "CLINIC_REQUEST", "PHYSIO_UNAVAILABLE"];
const AWAY = new Set(["ON_BREAK", "OFF_DUTY", "UNAVAILABLE"]);
const BASE_STATUS = new Set(["AVAILABLE", "ON_BREAK", "OFF_DUTY", "UNAVAILABLE"]);

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 32, SCRYPT).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password, stored) {
  const actual = crypto.scryptSync(password, stored.salt, 32, SCRYPT);
  const expected = Buffer.from(stored.hash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function maskPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `${digits.slice(0, 2)}••••••${digits.slice(-2)}`;
}

export function formatInr(paise) {
  const n = Number.isInteger(paise) ? paise : 0;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}₹${Math.floor(abs / 100).toLocaleString("en-IN")}.${String(abs % 100).padStart(2, "0")}`;
}

export function istParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function istIso(year, month, day, hour, minute) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - 5.5 * 60 * 60 * 1000).toISOString();
}

export function fyLabel(date = new Date()) {
  const { year, month } = istParts(date);
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

function percent(amount, bps) {
  return Math.round((amount * bps) / 10000);
}

function dayKey(iso) {
  const p = istParts(new Date(iso));
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function todayKey(now = new Date()) {
  const p = istParts(now);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export class HttpError extends Error {
  constructor(status, code, message, fieldErrors = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function fail(status, code, message, fieldErrors) {
  throw new HttpError(status, code, message, fieldErrors);
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

const DEFAULT_CONSULT = { days: [1, 2, 3, 4, 5, 6], start: "09:00", end: "18:00" };
const CONSULT_PRESETS = {
  "ph-neha": { days: [1, 2, 3, 4, 5, 6], start: "09:00", end: "17:00" },
  "ph-vikram": { days: [1, 2, 3, 4, 5], start: "10:00", end: "16:00" },
  "ph-aisha": { days: [1, 2, 3, 4, 5, 6], start: "11:00", end: "19:00" },
  "ph-suresh": { days: [1, 2, 3, 4, 5, 6], start: "09:00", end: "18:00" },
};

function consultOf(physio) {
  const consult = physio?.consult;
  if (!consult || !Array.isArray(consult.days) || !/^\d{2}:\d{2}$/.test(consult.start || "") || !/^\d{2}:\d{2}$/.test(consult.end || "")) return { ...DEFAULT_CONSULT, days: [...DEFAULT_CONSULT.days] };
  return consult;
}

function leaveOf(physio) {
  return Array.isArray(physio?.leave) ? physio.leave : [];
}

function minutesOf(value) {
  const [hour, minute] = String(value).split(":").map(Number);
  return hour * 60 + minute;
}

function weekdayOf(dateKey) {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

function onLeave(physio, dateKey) {
  return leaveOf(physio).some((item) => item.from <= dateKey && dateKey <= item.to);
}

function durationChoices(service) {
  const slot = service?.durationMin || service?.minDurationMin || 30;
  if (service?.kind === "CONSULT") return [slot];
  const step = service?.durationStepMin || slot;
  const min = service?.minDurationMin || slot;
  const max = service?.maxDurationMin || slot * (service?.maxSlots || 1);
  if (step === slot && min === slot) {
    const maxSlots = Math.min(8, service?.maxSlots || Math.max(1, Math.floor(max / slot)));
    const choices = [];
    for (let count = 1; count <= maxSlots; count += 1) {
      const minutes = slot * count;
      if (minutes > 480) break;
      choices.push(minutes);
    }
    return choices.length ? choices : [slot];
  }
  const choices = [];
  for (let minutes = min; minutes <= max; minutes += step) choices.push(minutes);
  return choices.length ? choices : [slot];
}

function normalizeService(service) {
  if (!service.kind) service.kind = /consult/i.test(service.name || "") ? "CONSULT" : "THERAPY";
  if (service.active == null) service.active = true;
  if (!service.durationMin) service.durationMin = service.minDurationMin || 30;
  if (!service.minDurationMin) service.minDurationMin = service.durationMin;
  if (service.kind === "CONSULT") {
    service.maxSlots = 1;
    service.durationStepMin = service.durationMin;
    service.minDurationMin = service.durationMin;
    service.maxDurationMin = service.durationMin;
  } else if (!Number.isInteger(service.maxSlots) || service.maxSlots < 1) {
    const step = service.durationStepMin || service.durationMin;
    const max = service.maxDurationMin || service.durationMin;
    const derived = step > 0 && max >= service.durationMin ? Math.floor((max - service.durationMin) / step) + 1 : 1;
    service.maxSlots = derived > 1 ? Math.min(8, derived) : 4;
    service.durationStepMin = service.durationMin;
    service.minDurationMin = service.durationMin;
    service.maxDurationMin = service.durationMin * service.maxSlots;
  }
  if (!service.categoryId) service.categoryId = service.kind === "CONSULT" ? "cat-consult" : "cat-therapy";
}

function migrateCatalog(data) {
  const changed = data.schemaVersion !== 2;
  if (!Array.isArray(data.categories)) {
    data.categories = [
      { id: "cat-consult", name: "Consultation", kind: "CONSULT", active: true },
      { id: "cat-therapy", name: "Therapy", kind: "THERAPY", active: true },
      { id: "cat-package", name: "Package", kind: "PACKAGE", active: true },
    ];
  } else if (!data.categories.some((item) => item.id === "cat-package")) {
    data.categories.push({ id: "cat-package", name: "Package", kind: "PACKAGE", active: true });
  }
  if (!Array.isArray(data.paymentMethods)) {
    data.paymentMethods = [
      { id: "pm-cash", code: "CASH", name: "Cash", active: true },
      { id: "pm-upi", code: "UPI", name: "UPI", active: true },
      { id: "pm-card", code: "CARD", name: "Card", active: true },
    ];
  }
  if (!data.bookingConfig || !Number.isInteger(data.bookingConfig.parallelTherapyCapacity)) {
    data.bookingConfig = { ...(data.bookingConfig || {}), parallelTherapyCapacity: data.bookingConfig?.parallelTherapyCapacity || 1 };
  }
  (data.services || []).forEach(normalizeService);
  (data.packages || []).forEach((pkg) => {
    if (pkg.active == null) pkg.active = true;
    if (!pkg.categoryId) pkg.categoryId = "cat-package";
  });
  (data.appointments || []).forEach((row) => {
    if (!row.durationMin) {
      const minutes = Math.round((new Date(row.end).getTime() - new Date(row.start).getTime()) / 60000);
      row.durationMin = minutes > 0 ? minutes : 30;
    }
    if (!row.slotCount) {
      const service = (data.services || []).find((item) => item.id === row.serviceId);
      const slot = service?.durationMin || row.durationMin;
      row.slotCount = slot > 0 && row.durationMin % slot === 0 ? row.durationMin / slot : 1;
    }
  });
  (data.invoices || []).forEach((invoice) => {
    if (invoice.transactionId == null) invoice.transactionId = "";
    if (!Array.isArray(invoice.appointmentIds)) invoice.appointmentIds = invoice.appointmentId ? [invoice.appointmentId] : [];
  });
  data.schemaVersion = 2;
  return changed;
}

function assertBookable(physio, startIso, endIso) {
  if (["OFF_DUTY", "UNAVAILABLE"].includes(physio.availability)) fail(409, "PHYSIO_UNAVAILABLE", "That physiotherapist is not available.");
  const startKey = dayKey(startIso);
  const endKey = dayKey(new Date(new Date(endIso).getTime() - 60000).toISOString());
  if (startKey !== endKey) fail(409, "OUTSIDE_HOURS", "A visit must start and finish on the same day.");
  if (onLeave(physio, startKey)) fail(409, "PHYSIO_ON_LEAVE", "That physiotherapist is on leave that day.");
  const consult = consultOf(physio);
  if (!consult.days.includes(weekdayOf(startKey))) fail(409, "OUTSIDE_HOURS", "That physiotherapist does not consult on this day.");
  const startParts = istParts(new Date(startIso));
  const endParts = istParts(new Date(endIso));
  const startMinutes = startParts.hour * 60 + startParts.minute;
  const endMinutes = endParts.hour * 60 + endParts.minute;
  if (startMinutes < minutesOf(consult.start) || endMinutes > minutesOf(consult.end)) fail(409, "OUTSIDE_HOURS", "That time is outside consultation hours.");
}

function ensureDemoCalendar(data) {
  if (!Array.isArray(data.physios) || !Array.isArray(data.appointments)) return false;
  let changed = false;
  for (const physio of data.physios) {
    if (!physio.consult) {
      physio.consult = CONSULT_PRESETS[physio.id] || { ...DEFAULT_CONSULT, days: [...DEFAULT_CONSULT.days] };
      changed = true;
    }
    if (!Array.isArray(physio.leave)) {
      physio.leave = [];
      changed = true;
    }
  }
  if (data.calendarDemo) return changed;
  const today = istParts(new Date());
  const dow = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay();
  const nextMonday = 7 - ((dow + 6) % 7);
  const atOffset = (dayOffset, hour, minute) => {
    const stamp = new Date(Date.UTC(today.year, today.month - 1, today.day) + dayOffset * 86400000);
    const parts = istParts(new Date(stamp.getTime() + 12 * 3600000));
    return { iso: istIso(parts.year, parts.month, parts.day, hour, minute), key: `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}` };
  };
  const duration = { "svc-consult": 30, "svc-exercise": 45, "svc-manual": 40 };
  const samples = [
    ["apt-next-ananya-neha", "br-kor", "pt-ananya", "ph-neha", "svc-consult", nextMonday, 10, 0],
    ["apt-next-ananya-suresh", "br-ind", "pt-ananya", "ph-suresh", "svc-exercise", nextMonday, 15, 0],
    ["apt-next-meera-vikram", "br-kor", "pt-meera", "ph-vikram", "svc-manual", nextMonday + 1, 11, 0],
    ["apt-next-rohan-neha", "br-kor", "pt-rohan", "ph-neha", "svc-exercise", nextMonday + 3, 16, 0],
    ["apt-next-fatima-suresh", "br-ind", "pt-fatima", "ph-suresh", "svc-consult", nextMonday + 4, 12, 0],
  ];
  for (const [id, branchId, patientId, physioId, serviceId, offset, hour, minute] of samples) {
    if (data.appointments.some((row) => row.id === id)) continue;
    if (!data.patients?.some((patient) => patient.id === patientId) || !data.physios.some((physio) => physio.id === physioId)) continue;
    const start = atOffset(offset, hour, minute);
    data.appointments.push({
      id, branchId, patientId, physioId, serviceId,
      start: start.iso,
      end: new Date(new Date(start.iso).getTime() + (duration[serviceId] || 30) * 60000).toISOString(),
      status: "BOOKED", queueStatus: null, reasonCode: null, invoiceId: null, packageConsumed: false, note: "",
    });
  }
  const aisha = data.physios.find((physio) => physio.id === "ph-aisha");
  if (aisha && !aisha.leave.some((item) => item.note === "Demo leave")) {
    const day = atOffset(nextMonday + 2, 12, 0);
    aisha.leave.push({ from: day.key, to: day.key, note: "Demo leave" });
  }
  data.calendarDemo = true;
  return true;
}

export function createSeed(now = new Date()) {
  const password = hashPassword("HealthWise#2026");
  const today = istParts(now);
  const at = (dayOffset, hour, minute) => {
    const stamp = new Date(Date.UTC(today.year, today.month - 1, today.day) + dayOffset * 86400000);
    const p = istParts(new Date(stamp.getTime() + 12 * 3600000));
    return istIso(p.year, p.month, p.day, hour, minute);
  };

  const branches = [
    { id: "br-kor", code: "BLR-KOR", name: "Koramangala", city: "Bengaluru", hours: "08:00–20:00" },
    { id: "br-ind", code: "BLR-IND", name: "Indiranagar", city: "Bengaluru", hours: "08:00–20:00" },
    { id: "br-wfd", code: "BLR-WFD", name: "Whitefield", city: "Bengaluru", hours: "09:00–19:00" },
  ];

  const services = [
    { id: "svc-consult", name: "Physiotherapy consultation", durationMin: 30 },
    { id: "svc-exercise", name: "Exercise therapy", durationMin: 45 },
    { id: "svc-manual", name: "Manual therapy", durationMin: 40 },
    { id: "svc-electro", name: "Electrotherapy", durationMin: 20 },
  ];

  const prices = {
    "br-kor:svc-consult": 80000,
    "br-kor:svc-exercise": 120000,
    "br-kor:svc-manual": 150000,
    "br-kor:svc-electro": 60000,
    "br-ind:svc-consult": 90000,
    "br-ind:svc-exercise": 130000,
    "br-ind:svc-manual": 160000,
    "br-ind:svc-electro": 65000,
    "br-wfd:svc-consult": 75000,
    "br-wfd:svc-exercise": 110000,
    "br-wfd:svc-manual": 140000,
    "br-wfd:svc-electro": 55000,
  };

  const physios = [
    { id: "ph-neha", name: "Dr. Neha Kulkarni", engagement: "EMPLOYEE", specialty: "Musculoskeletal", branchId: "br-kor", availability: "AVAILABLE", ratingSum: 48, reviewCount: 10 },
    { id: "ph-vikram", name: "Dr. Vikram Desai", engagement: "CONSULTANT", specialty: "Sports", branchId: "br-kor", availability: "AVAILABLE", ratingSum: 36, reviewCount: 8 },
    { id: "ph-aisha", name: "Dr. Aisha Rahman", engagement: "EMPLOYEE", specialty: "Neuro", branchId: "br-kor", availability: "ON_BREAK", ratingSum: 27, reviewCount: 6 },
    { id: "ph-suresh", name: "Dr. Suresh Babu", engagement: "EMPLOYEE", specialty: "Orthopaedic", branchId: "br-ind", availability: "AVAILABLE", ratingSum: 42, reviewCount: 9 },
  ];

  const users = [
    { id: "usr-org", name: "Priya Shah", email: "priya.shah@healthwise.local", role: "ORG_ADMIN", branchIds: branches.map((b) => b.id), password, termsAccepted: true },
    { id: "usr-branch", name: "Arun Nair", email: "arun.nair@healthwise.local", role: "BRANCH_ADMIN", branchIds: ["br-kor"], password, termsAccepted: true },
    { id: "usr-staff", name: "Leela D'Souza", email: "leela.reception@healthwise.local", role: "STAFF", branchIds: ["br-kor"], password, termsAccepted: true },
    { id: "usr-physio", name: "Dr. Neha Kulkarni", email: "neha.kulkarni@healthwise.local", role: "PHYSIO", branchIds: ["br-kor"], physioId: "ph-neha", password, termsAccepted: true },
  ];

  const patients = [
    { id: "pt-ananya", code: "HW-10021", name: "Ananya Rao", phone: "9845012345", gender: "Female", dob: "1992-04-18", branchId: "br-kor", isMinor: false, flags: ["Package"], mergedInto: null, email: "ananya.rao@example.com", address: "12, 4th Cross, Koramangala, Bengaluru", occupation: "Designer", bloodGroup: "B+", referringDoctor: "Dr. Mehta", condition: "Lumbar strain", affectedArea: "Lower back", painScore: 4, onset: "6 weeks", precautions: "Avoid loaded flexion", emergencyName: "Rohan Rao", emergencyPhone: "9845012345" },
    { id: "pt-rohan", code: "HW-10088", name: "Rohan Rao", phone: "9845012345", gender: "Male", dob: "1990-11-02", branchId: "br-kor", isMinor: false, flags: ["Shared phone"], mergedInto: null, email: "rohan.rao@example.com", address: "12, 4th Cross, Koramangala, Bengaluru", occupation: "Engineer", bloodGroup: "O+", condition: "Shoulder impingement", affectedArea: "Right shoulder", painScore: 6, onset: "3 weeks", precautions: "", emergencyName: "Ananya Rao", emergencyPhone: "9845012345" },
    { id: "pt-meera", code: "HW-10042", name: "Meera Iyer", phone: "9900123456", gender: "Female", dob: "1986-07-09", branchId: "br-kor", isMinor: false, flags: [], mergedInto: null, email: "meera.iyer@example.com", address: "Indiranagar, Bengaluru", occupation: "Teacher", bloodGroup: "A+", condition: "Knee osteoarthritis", affectedArea: "Left knee", painScore: 5, onset: "1 year", precautions: "No deep squats", emergencyName: "Arun Iyer", emergencyPhone: "9900099000" },
    { id: "pt-kabir", code: "HW-10103", name: "Kabir Shah", phone: "9811122233", gender: "Male", dob: "2016-01-22", branchId: "br-kor", isMinor: true, flags: ["Minor"], guardian: { name: "Leela Shah", idType: "AADHAAR", idLast4: "4321", consent: true }, mergedInto: null },
    { id: "pt-fatima", code: "HW-10077", name: "Fatima Khan", phone: "9888001122", gender: "Female", dob: "1978-09-30", branchId: "br-kor", isMinor: false, flags: ["Dues"], mergedInto: null },
    { id: "pt-arjun", code: "HW-10220", name: "Arjun Menon", phone: "9744412340", gender: "Male", dob: "1998-02-14", branchId: "br-ind", isMinor: false, flags: [], mergedInto: null },
  ];

  const endFrom = (start, serviceId) => {
    const mins = services.find((s) => s.id === serviceId).durationMin;
    return new Date(new Date(start).getTime() + mins * 60000).toISOString();
  };

  const appointments = [
    { id: "apt-ananya", branchId: "br-kor", patientId: "pt-ananya", physioId: "ph-neha", serviceId: "svc-consult", start: at(0, 9, 0), status: "BOOKED", queueStatus: null, reasonCode: null, invoiceId: null, packageConsumed: false },
    { id: "apt-rohan", branchId: "br-kor", patientId: "pt-rohan", physioId: "ph-neha", serviceId: "svc-exercise", start: at(0, 9, 30), status: "CHECKED_IN", queueStatus: "WAITING", reasonCode: null, invoiceId: null, packageConsumed: false },
    { id: "apt-meera", branchId: "br-kor", patientId: "pt-meera", physioId: "ph-vikram", serviceId: "svc-manual", start: at(0, 10, 0), status: "IN_SERVICE", queueStatus: "IN_SERVICE", reasonCode: null, invoiceId: null, packageConsumed: false },
    { id: "apt-fatima", branchId: "br-kor", patientId: "pt-fatima", physioId: "ph-aisha", serviceId: "svc-consult", start: at(0, 11, 0), status: "BOOKED", queueStatus: null, reasonCode: null, invoiceId: null, packageConsumed: false },
    { id: "apt-kabir", branchId: "br-kor", patientId: "pt-kabir", physioId: "ph-neha", serviceId: "svc-consult", start: at(0, 15, 30), status: "BOOKED", queueStatus: null, reasonCode: null, invoiceId: null, packageConsumed: false },
    { id: "apt-arjun", branchId: "br-ind", patientId: "pt-arjun", physioId: "ph-suresh", serviceId: "svc-exercise", start: at(0, 11, 30), status: "BOOKED", queueStatus: null, reasonCode: null, invoiceId: null, packageConsumed: false },
  ].map((row) => ({ ...row, end: endFrom(row.start, row.serviceId), note: "" }));

  const visits = [
    { id: "vis-meera", appointmentId: "apt-meera", patientId: "pt-meera", physioId: "ph-vikram", branchId: "br-kor", status: "IN_SERVICE", note: "", startedAt: at(0, 10, 2), completedAt: null },
  ];

  for (let i = 1; i <= 8; i += 1) {
    const physio = physios[i % 3];
    const patient = patients[i % 5];
    const id = `apt-past-${i}`;
    const start = at(-i, 8 + (i % 6), 0);
    appointments.push({
      id,
      branchId: physio.branchId,
      patientId: patient.branchId === physio.branchId ? patient.id : "pt-ananya",
      physioId: physio.id,
      serviceId: "svc-consult",
      start,
      end: endFrom(start, "svc-consult"),
      status: "COMPLETED",
      queueStatus: "DONE",
      reasonCode: null,
      invoiceId: i === 1 ? "inv-fatima" : `inv-past-${i}`,
      packageConsumed: false,
      note: "Session completed. Home advice given.",
    });
    visits.push({
      id: `vis-past-${i}`,
      appointmentId: id,
      patientId: patient.branchId === physio.branchId ? patient.id : "pt-ananya",
      physioId: physio.id,
      branchId: physio.branchId,
      status: "COMPLETED",
      note: "Session completed. Home advice given.",
      startedAt: start,
      completedAt: endFrom(start, "svc-consult"),
    });
  }

  const invoices = [
    {
      id: "inv-fatima",
      number: "KOR/2026-27/0007",
      branchId: "br-kor",
      patientId: "pt-fatima",
      appointmentId: "apt-past-1",
      status: "POSTED",
      gstMode: "REGULAR",
      lines: [{ serviceId: "svc-exercise", name: "Exercise therapy", qty: 1, unitPaise: 120000, taxBps: GST_BPS }],
      discountBps: 0,
      subtotalPaise: 120000,
      discountPaise: 0,
      taxPaise: 21600,
      totalPaise: 141600,
      paidPaise: 50000,
      postedAt: at(-1, 12, 0),
    },
  ];

  return {
    organization: { id: "org-hw", name: "HealthWise Physiotherapy", gstMode: "REGULAR", gstBps: GST_BPS, discountCapBps: DISCOUNT_CAP_BPS },
    branches,
    services,
    prices,
    physios,
    users,
    patients,
    appointments,
    visits,
    invoices,
    payments: [{ id: "pay-fatima", invoiceId: "inv-fatima", method: "UPI", amountPaise: 50000, at: at(-1, 12, 10) }],
    creditNotes: [],
    packages: [
      { id: "pkg-rehab", name: "8-session rehab", credits: 8, prices: { "br-kor": 800000, "br-ind": 880000, "br-wfd": 760000 } },
      { id: "pkg-posture", name: "Posture reset (4)", credits: 4, prices: { "br-kor": 420000, "br-ind": 460000, "br-wfd": 390000 } },
    ],
    purchases: [
      { id: "pur-ananya", patientId: "pt-ananya", packageId: "pkg-rehab", branchId: "br-kor", creditsTotal: 8, creditsLeft: 5, frozen: false, expiresOn: "2027-04-01", status: "ACTIVE" },
    ],
    notifications: [
      { id: "ntf-1", branchId: "br-kor", patientId: "pt-rohan", channel: "WHATSAPP", template: "REMINDER", status: "FAILED", attempts: 2, lastError: "Provider timeout", at: at(0, 8, 10) },
      { id: "ntf-2", branchId: "br-kor", patientId: "pt-ananya", channel: "SMS", template: "BOOKING", status: "SENT", attempts: 1, lastError: "", at: at(0, 8, 0) },
    ],
    audit: [],
    flags: { patientBooking: true, publicRatings: true },
    invoiceSeq: { "br-kor": 7, "br-ind": 2, "br-wfd": 0 },
    sessions: [],
    idempotency: {},
    feedback: [],
  };
}

export function createStore(options = {}) {
  const data = options.data || createSeed(options.now || new Date());
  const file = options.file || null;
  const mfaCode = options.mfaCode || "246810";
  const otpCode = options.otpCode || "482910";
  const challenges = new Map();
  const loginAttempts = new Map();
  const seededCalendar = ensureDemoCalendar(data);
  const migrated = migrateCatalog(data);

  function save() {
    if (file) {
      fs.mkdirSync(file.replace(/[\\/][^\\/]+$/, ""), { recursive: true });
      const snapshot = { ...data, sessions: data.sessions.map(({ token, ...rest }) => ({ token, ...rest })) };
      fs.writeFileSync(file, JSON.stringify(snapshot));
    }
    options.onSave?.(data);
  }

  if (seededCalendar || migrated) save();

  function audit(actor, action, branchId, targetType, targetId, outcome, correlationId) {
    data.audit.unshift({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      actorId: actor?.id || null,
      actorName: actor?.name || "system",
      action,
      branchId: branchId || null,
      targetType,
      targetId,
      outcome,
      correlationId: correlationId || null,
    });
  }

  function userView(user) {
    return {
      id: user.id,
      name: user.name,
      email: user.email || null,
      role: user.role,
      branchIds: user.branchIds || [],
      physioId: user.physioId || null,
      patientId: user.patientId || null,
    };
  }

  function assertAuth(user) {
    if (!user) fail(401, "UNAUTHENTICATED", "Sign in to continue.");
  }

  function assertBranch(user, branchId) {
    assertAuth(user);
    if (!branchId) fail(400, "BRANCH_REQUIRED", "Choose a branch.");
    if (user.role === "ORG_ADMIN") return;
    if (user.role === "PATIENT") fail(403, "FORBIDDEN", "Patients cannot switch clinic branches.");
    if (!(user.branchIds || []).includes(branchId)) fail(403, "FORBIDDEN", "You do not have access to this branch.");
  }

  function branchOf(id) {
    return data.branches.find((b) => b.id === id) || null;
  }

  function patientOf(id) {
    return data.patients.find((p) => p.id === id && !p.mergedInto) || null;
  }

  function serviceOf(id) {
    return data.services.find((s) => s.id === id) || null;
  }

  function physioOf(id) {
    return data.physios.find((p) => p.id === id) || null;
  }

  function liveStatus(physio) {
    const active = data.appointments.some((a) => a.physioId === physio.id && a.status === "IN_SERVICE");
    if (active) return "IN_SERVICE";
    return physio.availability;
  }

  function publicPatient(patient, reveal = false) {
    const dues = data.invoices
      .filter((inv) => inv.patientId === patient.id && inv.status === "POSTED")
      .reduce((sum, inv) => sum + (inv.totalPaise - inv.paidPaise), 0);
    const packs = data.purchases.filter((p) => p.patientId === patient.id && p.status === "ACTIVE");
    return {
      id: patient.id,
      code: patient.code,
      name: patient.name,
      phoneMasked: maskPhone(patient.phone),
      phone: reveal ? patient.phone : undefined,
      gender: patient.gender,
      dob: patient.dob,
      branchId: patient.branchId,
      branchName: branchOf(patient.branchId)?.name || "",
      isMinor: patient.isMinor,
      guardian: patient.guardian ? { name: patient.guardian.name, idType: patient.guardian.idType, idLast4: patient.guardian.idLast4, consent: patient.guardian.consent } : null,
      flags: patient.flags || [],
      duesPaise: dues,
      packageCredits: packs.reduce((sum, p) => sum + p.creditsLeft, 0),
      email: patient.email || "",
      address: patient.address || "",
      emergencyName: patient.emergencyName || "",
      emergencyPhone: patient.emergencyPhone || "",
      occupation: patient.occupation || "",
      bloodGroup: patient.bloodGroup || "",
      referringDoctor: patient.referringDoctor || "",
      condition: patient.condition || "",
      affectedArea: patient.affectedArea || "",
      painScore: Number.isInteger(patient.painScore) ? patient.painScore : null,
      onset: patient.onset || "",
      precautions: patient.precautions || "",
    };
  }

  function publicAppointment(row) {
    const patient = data.patients.find((p) => p.id === row.patientId);
    const physio = physioOf(row.physioId);
    const service = serviceOf(row.serviceId);
    const branch = branchOf(row.branchId);
    return {
      id: row.id,
      branchId: row.branchId,
      branchName: branch?.name || "",
      patientId: row.patientId,
      patientName: patient?.name || "Unknown",
      patientCode: patient?.code || "",
      phoneMasked: patient ? maskPhone(patient.phone) : "",
      physioId: row.physioId,
      physioName: physio?.name || "",
      serviceId: row.serviceId,
      serviceName: service?.name || "",
      start: row.start,
      end: row.end,
      status: row.status,
      queueStatus: row.queueStatus,
      reasonCode: row.reasonCode,
      note: row.note || "",
      invoiceId: row.invoiceId,
      packageConsumed: row.packageConsumed,
      durationMin: row.durationMin || Math.round((new Date(row.end).getTime() - new Date(row.start).getTime()) / 60000),
      slotCount: row.slotCount || 1,
      serviceKind: service?.kind || "THERAPY",
    };
  }

  function priceFor(branchId, serviceId) {
    const key = `${branchId}:${serviceId}`;
    if (!(key in data.prices)) fail(400, "SERVICE_UNAVAILABLE", "This service is not offered at the selected branch.");
    return data.prices[key];
  }

  function activePaymentMethods() {
    return (data.paymentMethods || []).filter((method) => method.active !== false);
  }

  function readDurationConfig(body, kind, explicitSlots = false) {
    if (explicitSlots) {
      const slot = Number(body.slotMin ?? body.durationMin);
      let slots = Number(body.maxSlots ?? 1);
      if (kind === "CONSULT") slots = 1;
      if (!Number.isInteger(slot) || slot < 5 || slot > 240) fail(400, "VALIDATION", "One slot must be a whole number of minutes from 5 to 240.");
      if (!Number.isInteger(slots) || slots < 1 || slots > 8) fail(400, "VALIDATION", "Choose from 1 to 8 slots. A consultation is always one slot.");
      if (slot * slots > 480) fail(400, "VALIDATION", "The full visit must finish within 8 hours.");
      return { minDurationMin: slot, durationStepMin: slot, maxDurationMin: slot * slots, durationMin: slot, maxSlots: slots };
    }
    const min = Number(body.minDurationMin ?? body.durationMin);
    const step = Number(body.durationStepMin ?? min);
    const max = Number(body.maxDurationMin ?? min);
    if (![min, step, max].every((value) => Number.isInteger(value) && value >= 5 && value <= 240)) fail(400, "VALIDATION", "Durations must be whole minutes from 5 to 240.");
    if (step < 5 || min > max || (max - min) % step !== 0) fail(400, "VALIDATION", "The maximum must land on the interval, starting from the minimum.");
    const slots = kind === "CONSULT" ? 1 : Math.max(1, Math.floor((max - min) / step) + 1);
    return { minDurationMin: min, durationStepMin: step, maxDurationMin: kind === "CONSULT" ? min : max, durationMin: min, maxSlots: slots };
  }

  function capacityFor(physio) {
    if (Number.isInteger(physio?.parallelTherapyCapacity) && physio.parallelTherapyCapacity > 0) return physio.parallelTherapyCapacity;
    const branch = branchOf(physio?.branchId);
    if (Number.isInteger(branch?.parallelTherapyCapacity) && branch.parallelTherapyCapacity > 0) return branch.parallelTherapyCapacity;
    const org = Number(data.bookingConfig?.parallelTherapyCapacity);
    return Number.isInteger(org) && org > 0 ? org : 1;
  }

  function resolveDuration(service, requested) {
    const choices = durationChoices(service);
    const minutes = requested == null || requested === "" ? choices[0] : Number(requested);
    if (!choices.includes(minutes)) {
      const slot = service?.durationMin || choices[0];
      const slots = choices.map((total) => `${total / slot} × ${slot} min`).join(", ");
      fail(400, "DURATION", service?.kind === "CONSULT" ? "A consultation can be booked as one slot only." : `Choose a whole number of slots: ${slots}.`);
    }
    return minutes;
  }

  function occupying(physioId, start, end, ignoreId) {
    return data.appointments.filter((row) => {
      if (row.id === ignoreId || row.physioId !== physioId) return false;
      if (!["BOOKED", "CHECKED_IN", "IN_SERVICE", "COMPLETED"].includes(row.status)) return false;
      return overlaps(start, end, row.start, row.end);
    });
  }

  function peakConcurrent(rows, start, end) {
    const points = [];
    const from = new Date(start).getTime();
    const to = new Date(end).getTime();
    for (const row of rows) {
      const open = Math.max(new Date(row.start).getTime(), from);
      const close = Math.min(new Date(row.end).getTime(), to);
      if (open < close) points.push([open, 1], [close, -1]);
    }
    points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let current = 0;
    let peak = 0;
    for (const [, delta] of points) {
      current += delta;
      if (current > peak) peak = current;
    }
    return peak;
  }

  let bookingLock = false;
  function withBookingLock(work) {
    if (bookingLock) fail(409, "SLOT_CONFLICT", "Another booking is being saved. Try again.");
    bookingLock = true;
    try {
      return work();
    } finally {
      bookingLock = false;
    }
  }

  function assertCapacity(physio, service, start, end, ignoreId) {
    const rows = occupying(physio.id, start, end, ignoreId);
    const consultClash = rows.some((row) => (serviceOf(row.serviceId)?.kind || "THERAPY") === "CONSULT");
    if (service.kind === "CONSULT") {
      if (rows.length) fail(409, "SLOT_CONFLICT", "A consultation cannot overlap another session for this physiotherapist.");
      return;
    }
    if (consultClash) fail(409, "SLOT_CONFLICT", "That time overlaps a consultation, so another session cannot be booked there.");
    const capacity = capacityFor(physio);
    if (peakConcurrent(rows, start, end) + 1 > capacity) {
      fail(409, "CAPACITY", `This physiotherapist can take ${capacity} therapy session${capacity === 1 ? "" : "s"} at the same time.`);
    }
  }

  function nextPatientCode() {
    const nums = data.patients.map((p) => Number(String(p.code).replace(/\D/g, ""))).filter((n) => Number.isFinite(n));
    return `HW-${Math.max(10000, ...nums) + 1}`;
  }

  function nextInvoiceNumber(branchId) {
    const branch = branchOf(branchId);
    data.invoiceSeq[branchId] = (data.invoiceSeq[branchId] || 0) + 1;
    const seq = String(data.invoiceSeq[branchId]).padStart(4, "0");
    const prefix = branch.code.split("-").pop();
    return `${prefix}/${fyLabel()}/${seq}`;
  }

  function rateLimit(key) {
    const now = Date.now();
    const bucket = (loginAttempts.get(key) || []).filter((t) => now - t < 10 * 60 * 1000);
    if (bucket.length >= 8) fail(429, "RATE_LIMITED", "Too many attempts. Wait a few minutes and try again.");
    bucket.push(now);
    loginAttempts.set(key, bucket);
  }

  function issueSession(user) {
    const session = {
      id: crypto.randomUUID(),
      token: crypto.randomBytes(24).toString("hex"),
      userId: user.id,
      role: user.role,
      createdAt: new Date().toISOString(),
      patientId: user.patientId || null,
    };
    data.sessions.push(session);
    save();
    return session;
  }

  function sessionUser(token) {
    const session = data.sessions.find((s) => s.token === token);
    if (!session) return null;
    if (session.patientId) {
      const patient = patientOf(session.patientId);
      if (!patient) return null;
      return {
        id: `portal:${patient.id}`,
        name: patient.name,
        role: "PATIENT",
        branchIds: [],
        branchId: patient.branchId,
        patientId: patient.id,
        patientCode: patient.code,
        sessionId: session.id,
      };
    }
    const user = data.users.find((u) => u.id === session.userId);
    if (!user) return null;
    return { ...userView(user), sessionId: session.id };
  }

  function idempotent(key, scope, body, producer) {
    if (!key) fail(400, "IDEMPOTENCY_KEY_REQUIRED", "Send an Idempotency-Key header for this action.");
    const fingerprint = crypto.createHash("sha256").update(JSON.stringify(body || {})).digest("hex");
    const slotKey = `${scope}:${key}`;
    const existing = data.idempotency[slotKey];
    if (existing) {
      if (existing.fingerprint !== fingerprint) fail(409, "IDEMPOTENCY_CONFLICT", "This idempotency key was already used with a different request.");
      return existing.result;
    }
    const result = producer();
    data.idempotency[slotKey] = { fingerprint, result };
    save();
    return result;
  }

  function notify(branchId, patientId, channel, template, status = "SENT", lastError = "") {
    data.notifications.unshift({
      id: crypto.randomUUID(),
      branchId,
      patientId,
      channel,
      template,
      status,
      attempts: status === "FAILED" ? 1 : 1,
      lastError,
      at: new Date().toISOString(),
    });
  }

  function reassignFuture(actor, physio, correlationId) {
    const nowIso = new Date().toISOString();
    const pending = data.appointments.filter((row) => row.physioId === physio.id && row.status === "BOOKED" && row.start > nowIso);
    for (const row of pending) {
      const candidate = data.physios.find((other) => {
        if (other.id === physio.id || other.branchId !== row.branchId) return false;
        if (other.availability !== "AVAILABLE") return false;
        return !data.appointments.some((otherRow) => {
          if (["CANCELLED", "NO_SHOW"].includes(otherRow.status)) return false;
          if (otherRow.physioId !== other.id) return false;
          return overlaps(row.start, row.end, otherRow.start, otherRow.end);
        });
      });
      if (candidate) {
        row.reassignedFrom = physio.id;
        row.physioId = candidate.id;
        notify(row.branchId, row.patientId, "WHATSAPP", "REASSIGNED");
        audit(actor, "APPOINTMENT_REASSIGNED", row.branchId, "appointment", row.id, "SUCCESS", correlationId);
      } else {
        row.status = "CANCELLED";
        row.queueStatus = null;
        row.reasonCode = "PHYSIO_UNAVAILABLE";
        notify(row.branchId, row.patientId, "SMS", "CANCELLED");
        audit(actor, "APPOINTMENT_CANCELLED", row.branchId, "appointment", row.id, "SUCCESS", correlationId);
      }
    }
  }

  return {
    data,
    save,
    sessionUser,
    maskPhone,
    formatInr,

    login(email, password) {
      const key = String(email || "").toLowerCase();
      rateLimit(`login:${key}`);
      const user = data.users.find((u) => u.email === key);
      if (!user || !verifyPassword(password || "", user.password)) fail(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
      const challengeId = crypto.randomUUID();
      challenges.set(challengeId, { kind: "mfa", userId: user.id, expires: Date.now() + 5 * 60 * 1000 });
      return { mfaRequired: true, challengeId };
    },

    verifyMfa(challengeId, code) {
      rateLimit(`mfa:${challengeId || "none"}`);
      const challenge = challenges.get(challengeId);
      if (!challenge || challenge.kind !== "mfa" || challenge.expires < Date.now()) fail(401, "MFA_EXPIRED", "The sign-in challenge expired. Start again.");
      if (String(code || "") !== mfaCode) fail(401, "MFA_INVALID", "That verification code is incorrect.");
      challenges.delete(challengeId);
      const user = data.users.find((u) => u.id === challenge.userId);
      const session = issueSession(user);
      audit(user, "LOGIN", user.branchIds[0], "session", session.id, "SUCCESS");
      return { token: session.token, user: userView(user) };
    },

    requestOtp(phone) {
      const digits = String(phone || "").replace(/\D/g, "");
      rateLimit(`otp:${digits}`);
      if (!/^\d{10}$/.test(digits)) fail(400, "VALIDATION", "Enter the 10-digit mobile number on the patient record.", [{ field: "phone", message: "Enter a 10-digit mobile number." }]);
      const matches = data.patients.filter((p) => p.phone === digits && !p.mergedInto);
      if (!matches.length) fail(404, "PATIENT_NOT_FOUND", "No patient profile uses that mobile number.");
      if (!data.flags.patientBooking) fail(403, "FEATURE_DISABLED", "Patient self-booking is turned off.");
      const challengeId = crypto.randomUUID();
      challenges.set(challengeId, { kind: "otp", phone: digits, expires: Date.now() + 5 * 60 * 1000 });
      return { challengeId, profileCount: matches.length };
    },

    verifyOtp(challengeId, code, patientId) {
      rateLimit(`otp-verify:${challengeId || "none"}`);
      const challenge = challenges.get(challengeId);
      if (!challenge || challenge.kind !== "otp" || challenge.expires < Date.now()) fail(401, "OTP_EXPIRED", "The code expired. Request a new one.");
      if (String(code || "") !== otpCode) fail(401, "OTP_INVALID", "That code is incorrect.");
      const matches = data.patients.filter((p) => p.phone === challenge.phone && !p.mergedInto);
      if (matches.length > 1 && !patientId) {
        return { selectProfile: true, profiles: matches.map((p) => ({ id: p.id, name: p.name, code: p.code })) };
      }
      const patient = matches.find((p) => (patientId ? p.id === patientId : true));
      if (!patient) fail(404, "PATIENT_NOT_FOUND", "Choose one of the family profiles.");
      challenges.delete(challengeId);
      const portalUser = { id: `portal:${patient.id}`, patientId: patient.id, role: "PATIENT" };
      const session = issueSession(portalUser);
      audit({ id: portalUser.id, name: patient.name }, "PATIENT_LOGIN", patient.branchId, "patient", patient.id, "SUCCESS");
      return {
        token: session.token,
        user: { id: portalUser.id, name: patient.name, role: "PATIENT", patientId: patient.id, patientCode: patient.code, branchId: patient.branchId, branchIds: [] },
      };
    },

    logout(token) {
      const session = data.sessions.find((s) => s.token === token);
      if (session) data.sessions = data.sessions.filter((s) => s.token !== token);
      save();
    },

    listSessions(user) {
      assertAuth(user);
      return data.sessions
        .filter((s) => (user.patientId ? s.patientId === user.patientId : s.userId === user.id))
        .map((s) => ({ id: s.id, createdAt: s.createdAt, current: s.id === user.sessionId }));
    },

    revokeSession(user, sessionId) {
      assertAuth(user);
      const session = data.sessions.find((s) => s.id === sessionId);
      if (!session) fail(404, "NOT_FOUND", "Session not found.");
      const owns = user.patientId ? session.patientId === user.patientId : session.userId === user.id || user.role === "ORG_ADMIN";
      if (!owns) fail(403, "FORBIDDEN", "You cannot revoke this session.");
      data.sessions = data.sessions.filter((s) => s.id !== sessionId);
      audit(user, "SESSION_REVOKED", null, "session", sessionId, "SUCCESS");
      save();
      return { revoked: true };
    },

    bootstrap(user, branchId) {
      assertAuth(user);
      if (user.role !== "PATIENT") assertBranch(user, branchId);
      const visibleBranches = user.role === "ORG_ADMIN" ? data.branches : data.branches.filter((b) => (user.branchIds || []).includes(b.id));
      const physios = data.physios
        .filter((p) => user.role === "PATIENT" || p.branchId === branchId)
        .map((p) => ({
          id: p.id,
          name: p.name,
          engagement: p.engagement,
          specialty: p.specialty,
          branchId: p.branchId,
          availability: p.availability,
          liveStatus: liveStatus(p),
          rating: p.reviewCount ? Math.round((p.ratingSum / p.reviewCount) * 10) / 10 : null,
          reviewCount: data.flags.publicRatings || user.role !== "PATIENT" ? p.reviewCount : null,
          gender: p.gender || "",
          phone: p.phone || "",
          email: p.email || data.users.find((account) => account.physioId === p.id)?.email || "",
          experienceYears: p.experienceYears ?? null,
          consult: consultOf(p),
          leave: leaveOf(p),
          parallelTherapyCapacity: capacityFor(p),
        }));
      return {
        organization: data.organization,
        branches: user.role === "PATIENT" ? data.branches : visibleBranches,
        services: data.services.filter((service) => service.active !== false).map((s) => ({ ...s, durations: durationChoices(s), pricePaise: user.role === "PATIENT" ? null : priceForSafe(branchId, s.id) })),
        booking: { parallelTherapyCapacity: data.bookingConfig.parallelTherapyCapacity },
        physios,
        flags: data.flags,
        paymentMethods: activePaymentMethods().map((method) => ({ code: method.code, name: method.name })),
        reasons: { cancel: CANCEL_REASONS, reschedule: RESCHEDULE_REASONS },
        prices: data.prices,
      };
    },

    dashboard(user, branchId) {
      assertBranch(user, branchId);
      const key = todayKey();
      const rows = data.appointments.filter((a) => a.branchId === branchId && dayKey(a.start) === key);
      const dues = data.invoices.filter((inv) => inv.branchId === branchId && inv.status === "POSTED").reduce((sum, inv) => sum + (inv.totalPaise - inv.paidPaise), 0);
      const unbilled = data.appointments.filter((a) => a.branchId === branchId && a.status === "COMPLETED" && !a.invoiceId).length;
      const physios = data.physios.filter((p) => p.branchId === branchId).map((p) => ({
        id: p.id,
        name: p.name,
        engagement: p.engagement,
        specialty: p.specialty,
        liveStatus: liveStatus(p),
        rating: p.reviewCount ? Math.round((p.ratingSum / p.reviewCount) * 10) / 10 : null,
        reviewCount: p.reviewCount,
        queue: rows.filter((a) => a.physioId === p.id && ["BOOKED", "CHECKED_IN", "IN_SERVICE"].includes(a.status)).map(publicAppointment),
      }));
      const alerts = [];
      const failed = data.notifications.filter((n) => n.branchId === branchId && n.status === "FAILED").length;
      if (failed) alerts.push({ tone: "warning", text: `${failed} notification${failed === 1 ? "" : "s"} failed delivery.` });
      if (unbilled) alerts.push({ tone: "warning", text: `${unbilled} completed visit${unbilled === 1 ? "" : "s"} still unbilled.` });
      if (dues > 0) alerts.push({ tone: "danger", text: `${formatInr(dues)} is outstanding at this branch.` });
      data.physios.filter((p) => p.branchId === branchId && ["OFF_DUTY", "UNAVAILABLE", "ON_BREAK"].includes(p.availability)).forEach((p) => {
        alerts.push({ tone: "info", text: `${p.name} is ${p.availability.replaceAll("_", " ").toLowerCase()}.` });
      });
      return {
        generatedAt: new Date().toISOString(),
        branch: branchOf(branchId),
        kpis: {
          appointmentsToday: rows.filter((a) => !["CANCELLED"].includes(a.status)).length,
          waiting: rows.filter((a) => a.queueStatus === "WAITING").length,
          inService: rows.filter((a) => a.status === "IN_SERVICE").length,
          unbilled,
          duesPaise: dues,
        },
        physios,
        upcoming: rows.filter((a) => ["BOOKED", "CHECKED_IN"].includes(a.status)).map(publicAppointment),
        alerts,
        activity: data.audit.filter((e) => e.branchId === branchId).slice(0, 6),
      };
    },

    searchPatients(user, q, branchId) {
      assertAuth(user);
      if (user.role === "PATIENT") {
        const self = patientOf(user.patientId);
        return self ? [publicPatient(self)] : [];
      }
      if (user.role !== "ORG_ADMIN") assertBranch(user, branchId);
      const query = String(q || "").trim().toLowerCase();
      const digits = query.replace(/\D/g, "");
      return data.patients
        .filter((p) => !p.mergedInto)
        .filter((p) => {
          if (user.role !== "ORG_ADMIN" && p.branchId !== branchId && digits.length < 6 && !p.code.toLowerCase().includes(query)) {
            return p.branchId === branchId;
          }
          return true;
        })
        .filter((p) => {
          if (!query) return user.role === "ORG_ADMIN" ? true : p.branchId === branchId;
          const phoneHit = digits.length >= 4 && p.phone.includes(digits);
          const nameHit = p.name.toLowerCase().includes(query);
          const codeHit = p.code.toLowerCase().includes(query);
          if (!(phoneHit || nameHit || codeHit)) return false;
          if (phoneHit || codeHit) return true;
          return user.role === "ORG_ADMIN" || p.branchId === branchId;
        })
        .map((p) => publicPatient(p));
    },

    getPatient(user, id) {
      assertAuth(user);
      const patient = data.patients.find((p) => p.id === id);
      if (!patient || patient.mergedInto) fail(404, "NOT_FOUND", "Patient not found.");
      if (user.role === "PATIENT" && user.patientId !== patient.id) fail(403, "FORBIDDEN", "You can only open your own profile.");
      if (user.role !== "PATIENT" && user.role !== "ORG_ADMIN") assertBranch(user, patient.branchId);
      audit(user, "PATIENT_CHART_READ", patient.branchId, "patient", patient.id, "SUCCESS");
      save();
      const timeline = data.appointments.filter((a) => a.patientId === patient.id).sort((a, b) => b.start.localeCompare(a.start)).map(publicAppointment);
      const invoices = data.invoices.filter((inv) => inv.patientId === patient.id);
      const purchases = data.purchases.filter((p) => p.patientId === patient.id).map((p) => ({
        ...p,
        packageName: data.packages.find((pkg) => pkg.id === p.packageId)?.name || "",
      }));
      return { patient: publicPatient(patient), timeline, invoices: invoices.map(publicInvoice), purchases };
    },

    createPatient(user, body, correlationId) {
      if (!["ORG_ADMIN", "BRANCH_ADMIN", "STAFF"].includes(user.role)) fail(403, "FORBIDDEN", "You cannot register patients.");
      assertBranch(user, body.branchId);
      const fieldErrors = [];
      const name = String(body.name || "").trim();
      const phone = String(body.phone || "").replace(/\D/g, "");
      if (name.length < 2) fieldErrors.push({ field: "name", message: "Enter the patient name." });
      if (!/^\d{10}$/.test(phone)) fieldErrors.push({ field: "phone", message: "Enter a 10-digit mobile number." });
      if (!["Female", "Male", "Other"].includes(body.gender)) fieldErrors.push({ field: "gender", message: "Choose a gender." });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dob || "")) fieldErrors.push({ field: "dob", message: "Enter a date of birth." });
      if (body.isMinor) {
        if (!String(body.guardianName || "").trim()) fieldErrors.push({ field: "guardianName", message: "A minor needs a primary guardian." });
        if (!/^\d{4}$/.test(String(body.guardianIdLast4 || ""))) fieldErrors.push({ field: "guardianIdLast4", message: "Enter the last 4 digits of the guardian ID." });
        if (body.guardianConsent !== true) fieldErrors.push({ field: "guardianConsent", message: "Guardian consent is required." });
      }
      if (fieldErrors.length) fail(400, "VALIDATION", "Check the highlighted fields.", fieldErrors);
      const patient = {
        id: crypto.randomUUID(),
        code: nextPatientCode(),
        name,
        phone,
        gender: body.gender,
        dob: body.dob,
        branchId: body.branchId,
        isMinor: Boolean(body.isMinor),
        flags: body.isMinor ? ["Minor"] : [],
        guardian: body.isMinor ? { name: String(body.guardianName).trim(), idType: "AADHAAR", idLast4: String(body.guardianIdLast4), consent: true } : null,
        mergedInto: null,
        ...clinicalFrom(body),
      };
      if (patient.painScore === "invalid") fail(400, "VALIDATION", "Pain score must be a whole number from 0 to 10.", [{ field: "painScore", message: "Use 0 to 10." }]);
      if (patient.emergencyPhone === "invalid") fail(400, "VALIDATION", "Emergency phone must be 10 digits.", [{ field: "emergencyPhone", message: "Enter a 10-digit number." }]);
      data.patients.push(patient);
      audit(user, "PATIENT_CREATED", patient.branchId, "patient", patient.id, "SUCCESS", correlationId);
      save();
      const samePhone = data.patients.filter((p) => p.phone === phone && !p.mergedInto);
      return { patient: publicPatient(patient), sharedPhone: samePhone.length > 1, matches: samePhone.map((p) => publicPatient(p)) };
    },

    updatePatient(user, id, body, correlationId) {
      const patient = patientOf(id);
      if (!patient) fail(404, "NOT_FOUND", "Patient not found.");
      if (!["ORG_ADMIN", "BRANCH_ADMIN", "STAFF", "PHYSIO"].includes(user.role)) fail(403, "FORBIDDEN", "You cannot update this patient.");
      if (user.role !== "ORG_ADMIN") assertBranch(user, patient.branchId);
      const next = clinicalFrom(body, patient);
      if (next.painScore === "invalid") fail(400, "VALIDATION", "Pain score must be a whole number from 0 to 10.", [{ field: "painScore", message: "Use 0 to 10." }]);
      if (next.emergencyPhone === "invalid") fail(400, "VALIDATION", "Emergency phone must be 10 digits.", [{ field: "emergencyPhone", message: "Enter a 10-digit number." }]);
      if (user.role === "PHYSIO") {
        delete next.email;
        delete next.address;
        delete next.emergencyName;
        delete next.emergencyPhone;
      }
      Object.assign(patient, next);
      audit(user, "PATIENT_UPDATED", patient.branchId, "patient", patient.id, "SUCCESS", correlationId);
      save();
      return { patient: publicPatient(patient) };
    },

    revealPhone(user, id, correlationId) {
      if (!["ORG_ADMIN", "BRANCH_ADMIN", "STAFF"].includes(user.role)) fail(403, "FORBIDDEN", "You cannot reveal patient phone numbers.");
      const patient = patientOf(id);
      if (!patient) fail(404, "NOT_FOUND", "Patient not found.");
      if (user.role !== "ORG_ADMIN") assertBranch(user, patient.branchId);
      audit(user, "PHONE_REVEAL", patient.branchId, "patient", patient.id, "SUCCESS", correlationId);
      save();
      return { phone: patient.phone, phoneMasked: maskPhone(patient.phone) };
    },

    mergePatients(user, sourceId, targetId, correlationId) {
      if (user.role !== "ORG_ADMIN") fail(403, "FORBIDDEN", "Only an organization admin can merge patients.");
      if (sourceId === targetId) fail(400, "VALIDATION", "Choose two different records.");
      const source = patientOf(sourceId);
      const target = patientOf(targetId);
      if (!source || !target) fail(404, "NOT_FOUND", "Patient not found.");
      source.mergedInto = target.id;
      data.appointments.forEach((row) => {
        if (row.patientId === source.id) row.patientId = target.id;
      });
      data.invoices.forEach((row) => {
        if (row.patientId === source.id) row.patientId = target.id;
      });
      data.purchases.forEach((row) => {
        if (row.patientId === source.id) row.patientId = target.id;
      });
      audit(user, "PATIENT_MERGED", target.branchId, "patient", target.id, "SUCCESS", correlationId);
      save();
      return { mergedInto: target.id, patient: publicPatient(target) };
    },

    exportPatient(user, id) {
      const patient = data.patients.find((p) => p.id === id);
      if (!patient) fail(404, "NOT_FOUND", "Patient not found.");
      const allowed = user.role === "ORG_ADMIN" || (user.role === "PATIENT" && user.patientId === id);
      if (!allowed) fail(403, "FORBIDDEN", "You cannot export this patient record.");
      audit(user, "PATIENT_EXPORT", patient.branchId, "patient", patient.id, "SUCCESS");
      save();
      return {
        exportedAt: new Date().toISOString(),
        patient: { ...publicPatient(patient, true), phone: patient.phone },
        appointments: data.appointments.filter((a) => a.patientId === id).map(publicAppointment),
        invoices: data.invoices.filter((inv) => inv.patientId === id).map(publicInvoice),
      };
    },

    availability(user, query) {
      assertAuth(user);
      if (user.role === "PATIENT" && !data.flags.patientBooking) fail(403, "FEATURE_DISABLED", "Patient self-booking is turned off.");
      if (!["PATIENT", "ORG_ADMIN", "BRANCH_ADMIN", "STAFF", "PHYSIO"].includes(user.role)) fail(403, "FORBIDDEN", "You cannot view availability.");
      const branchId = query.branchId;
      const physio = physioOf(query.physioId);
      if (user.role !== "PATIENT") assertBranch(user, branchId);
      if (!physio || physio.branchId !== branchId) fail(400, "VALIDATION", "Choose a physiotherapist at this branch.");
      const from = String(query.from || "");
      const to = String(query.to || "");
      if (!from || !to) fail(400, "VALIDATION", "Choose a week to view.");
      const busy = data.appointments
        .filter((row) => row.physioId === physio.id && !["CANCELLED", "NO_SHOW"].includes(row.status) && row.start < to && from < row.end)
        .map((row) => {
          const mine = user.role === "PATIENT" ? row.patientId === user.patientId : true;
          return {
            id: mine ? row.id : undefined,
            start: row.start,
            end: row.end,
            status: row.status,
            mine,
            serviceName: mine ? (serviceOf(row.serviceId)?.name || "") : "",
            durationMin: mine ? row.durationMin : undefined,
            slotCount: mine ? row.slotCount || 1 : undefined,
            kind: serviceOf(row.serviceId)?.kind || "THERAPY",
          };
        });
      return {
        physio: { id: physio.id, name: physio.name, specialty: physio.specialty, availability: physio.availability, liveStatus: liveStatus(physio), branchId: physio.branchId, consult: consultOf(physio), leave: leaveOf(physio), parallelTherapyCapacity: capacityFor(physio) },
        busy,
      };
    },

    listAppointments(user, branchId, date) {
      assertAuth(user);
      let rows = data.appointments;
      if (user.role === "PATIENT") rows = rows.filter((a) => a.patientId === user.patientId);
      else {
        assertBranch(user, branchId);
        rows = rows.filter((a) => a.branchId === branchId);
        if (user.role === "PHYSIO") rows = rows.filter((a) => a.physioId === user.physioId);
      }
      if (date) rows = rows.filter((a) => dayKey(a.start) === date);
      return rows.sort((a, b) => a.start.localeCompare(b.start)).map(publicAppointment);
    },

    book(user, body, key, correlationId) {
      return idempotent(key, "book", body, () => {
        if (user.role === "PATIENT") {
          if (!data.flags.patientBooking) fail(403, "FEATURE_DISABLED", "Patient self-booking is turned off.");
          body = { ...body, patientId: user.patientId };
        } else if (!["ORG_ADMIN", "BRANCH_ADMIN", "STAFF", "PHYSIO"].includes(user.role)) {
          fail(403, "FORBIDDEN", "You cannot book appointments.");
        }
        const patient = patientOf(body.patientId);
        const physio = physioOf(body.physioId);
        const service = serviceOf(body.serviceId);
        if (!patient) fail(404, "NOT_FOUND", "Patient not found.");
        if (!physio || !service) fail(400, "VALIDATION", "Choose a physiotherapist and a service.");
        if (user.role !== "PATIENT") assertBranch(user, body.branchId);
        if (physio.branchId !== body.branchId) fail(400, "VALIDATION", "Choose a physiotherapist at this branch.");
        if (service.active === false) fail(400, "SERVICE_UNAVAILABLE", "That therapy is not active.");
        if (["OFF_DUTY", "UNAVAILABLE"].includes(physio.availability)) fail(409, "PHYSIO_UNAVAILABLE", "That physiotherapist is not available.");
        const start = new Date(body.start);
        if (Number.isNaN(start.getTime())) fail(400, "VALIDATION", "Choose a valid start time.");
        if (user.role === "PATIENT" && start.getTime() < Date.now()) fail(400, "VALIDATION", "Choose a future slot.");
        const minutes = resolveDuration(service, body.durationMin);
        const end = new Date(start.getTime() + minutes * 60000).toISOString();
        assertBookable(physio, start.toISOString(), end);
        priceFor(body.branchId, service.id);
        const row = withBookingLock(() => {
        assertCapacity(physio, service, start.toISOString(), end);
        const booked = {
          id: crypto.randomUUID(),
          branchId: body.branchId,
          patientId: patient.id,
          physioId: physio.id,
          serviceId: service.id,
          durationMin: minutes,
          slotCount: Math.max(1, Math.round(minutes / (service.durationMin || minutes))),
          start: start.toISOString(),
          end,
          status: "BOOKED",
          queueStatus: null,
          reasonCode: null,
          invoiceId: null,
          packageConsumed: false,
          note: "",
        };
        data.appointments.push(booked);
        return booked;
        });
        notify(row.branchId, row.patientId, "WHATSAPP", "BOOKING");
        audit(user, "APPOINTMENT_BOOKED", row.branchId, "appointment", row.id, "SUCCESS", correlationId);
        save();
        return publicAppointment(row);
      });
    },

    checkIn(user, id, correlationId) {
      const row = mustAppointment(user, id);
      if (user.role === "PHYSIO") fail(403, "FORBIDDEN", "Reception checks patients in.");
      if (!["BOOKED"].includes(row.status)) fail(409, "INVALID_STATE", "Only a booked appointment can be checked in.");
      row.status = "CHECKED_IN";
      row.queueStatus = "WAITING";
      audit(user, "CHECKED_IN", row.branchId, "appointment", row.id, "SUCCESS", correlationId);
      save();
      return publicAppointment(row);
    },

    cancel(user, id, reasonCode, correlationId) {
      if (!CANCEL_REASONS.includes(reasonCode)) fail(400, "VALIDATION", "Choose a cancellation reason.");
      const row = mustAppointment(user, id);
      if (user.role === "PHYSIO" && row.physioId !== user.physioId) fail(403, "FORBIDDEN", "You can change only your own appointments.");
      assertPolicyWindow(user, row);
      if (!["BOOKED", "CHECKED_IN"].includes(row.status)) fail(409, "INVALID_STATE", "This appointment can no longer be cancelled.");
      row.status = "CANCELLED";
      row.queueStatus = null;
      row.reasonCode = reasonCode;
      notify(row.branchId, row.patientId, "SMS", "CANCELLED");
      audit(user, "APPOINTMENT_CANCELLED", row.branchId, "appointment", row.id, "SUCCESS", correlationId);
      save();
      return publicAppointment(row);
    },

    reschedule(user, id, startRaw, reasonCode, correlationId) {
      if (!RESCHEDULE_REASONS.includes(reasonCode)) fail(400, "VALIDATION", "Choose a reschedule reason.");
      const row = mustAppointment(user, id);
      if (user.role === "PHYSIO" && row.physioId !== user.physioId) fail(403, "FORBIDDEN", "You can change only your own appointments.");
      assertPolicyWindow(user, row);
      if (!["BOOKED", "CHECKED_IN"].includes(row.status)) fail(409, "INVALID_STATE", "This appointment can no longer be rescheduled.");
      const start = new Date(startRaw);
      if (Number.isNaN(start.getTime())) fail(400, "VALIDATION", "Choose a valid start time.");
      const minutes = row.durationMin || Math.round((new Date(row.end).getTime() - new Date(row.start).getTime()) / 60000);
      const end = new Date(start.getTime() + minutes * 60000).toISOString();
      const physio = physioOf(row.physioId);
      const service = serviceOf(row.serviceId);
      withBookingLock(() => {
        if (physio && service) assertCapacity(physio, service, start.toISOString(), end, row.id);
      });
      if (physio) assertBookable(physio, start.toISOString(), end);
      row.start = start.toISOString();
      row.end = end;
      row.reasonCode = reasonCode;
      row.status = "BOOKED";
      row.queueStatus = null;
      notify(row.branchId, row.patientId, "WHATSAPP", "RESCHEDULED");
      audit(user, "APPOINTMENT_RESCHEDULED", row.branchId, "appointment", row.id, "SUCCESS", correlationId);
      save();
      return publicAppointment(row);
    },

    noShow(user, id, correlationId) {
      if (user.role === "PATIENT") fail(403, "FORBIDDEN", "Patients cannot mark a no-show.");
      const row = mustAppointment(user, id);
      if (!["BOOKED", "CHECKED_IN"].includes(row.status)) fail(409, "INVALID_STATE", "This visit cannot be marked as a no-show.");
      row.status = "NO_SHOW";
      row.queueStatus = null;
      row.reasonCode = "PATIENT_ABSENT";
      audit(user, "NO_SHOW", row.branchId, "appointment", row.id, "SUCCESS", correlationId);
      save();
      return publicAppointment(row);
    },

    walkIn(user, body, correlationId) {
      if (!["ORG_ADMIN", "BRANCH_ADMIN", "STAFF"].includes(user.role)) fail(403, "FORBIDDEN", "Reception records walk-ins.");
      assertBranch(user, body.branchId);
      const patient = patientOf(body.patientId);
      const physio = physioOf(body.physioId);
      const service = serviceOf(body.serviceId);
      if (!patient || !physio || !service) fail(400, "VALIDATION", "Choose a patient, physiotherapist and service.");
      if (physio.branchId !== body.branchId) fail(400, "VALIDATION", "Choose a physiotherapist at this branch.");
      if (service.active === false) fail(400, "SERVICE_UNAVAILABLE", "That therapy is not active.");
      const minutes = resolveDuration(service, body.durationMin);
      const start = new Date();
      const end = new Date(start.getTime() + minutes * 60000).toISOString();
      assertBookable(physio, start.toISOString(), end);
      const row = withBookingLock(() => {
        assertCapacity(physio, service, start.toISOString(), end);
        const booked = {
          id: crypto.randomUUID(),
          branchId: body.branchId,
          patientId: patient.id,
          physioId: physio.id,
          serviceId: service.id,
          durationMin: minutes,
          slotCount: Math.max(1, Math.round(minutes / (service.durationMin || minutes))),
          start: start.toISOString(),
          end,
          status: "CHECKED_IN",
          queueStatus: "WAITING",
          reasonCode: null,
          invoiceId: null,
          packageConsumed: false,
          note: "",
          walkIn: true,
        };
        data.appointments.push(booked);
        return booked;
      });
      audit(user, "WALK_IN", row.branchId, "appointment", row.id, "SUCCESS", correlationId);
      save();
      return publicAppointment(row);
    },

    startVisit(user, id, correlationId) {
      const row = mustAppointment(user, id);
      if (user.role === "PHYSIO" && row.physioId !== user.physioId) fail(403, "FORBIDDEN", "You can start only your own sessions.");
      if (!["BOOKED", "CHECKED_IN"].includes(row.status)) fail(409, "INVALID_STATE", "This visit cannot be started.");
      const physio = physioOf(row.physioId);
      if (["OFF_DUTY", "UNAVAILABLE"].includes(physio.availability)) fail(409, "PHYSIO_UNAVAILABLE", "This physiotherapist is off the board.");
      const busy = data.appointments.some((other) => other.id !== row.id && other.physioId === physio.id && other.status === "IN_SERVICE");
      if (busy) fail(409, "PHYSIO_BUSY", "Finish the current session before starting another.");
      row.status = "IN_SERVICE";
      row.queueStatus = "IN_SERVICE";
      data.visits.push({
        id: crypto.randomUUID(),
        appointmentId: row.id,
        patientId: row.patientId,
        physioId: row.physioId,
        branchId: row.branchId,
        status: "IN_SERVICE",
        note: row.note || "",
        startedAt: new Date().toISOString(),
        completedAt: null,
      });
      audit(user, "VISIT_STARTED", row.branchId, "appointment", row.id, "SUCCESS", correlationId);
      save();
      return publicAppointment(row);
    },

    completeVisit(user, id, note, usePackage, correlationId) {
      const row = mustAppointment(user, id);
      if (user.role === "PHYSIO" && row.physioId !== user.physioId) fail(403, "FORBIDDEN", "You can complete only your own sessions.");
      if (!["PHYSIO", "STAFF", "BRANCH_ADMIN", "ORG_ADMIN"].includes(user.role)) fail(403, "FORBIDDEN", "You cannot complete a visit.");
      if (row.status !== "IN_SERVICE") fail(409, "INVALID_STATE", "Start the visit before completing it.");
      const text = String(note || "").trim();
      if (text.length < 8) fail(400, "VALIDATION", "Add a short clinical note before completing the session.", [{ field: "note", message: "Enter at least a short note." }]);
      if (usePackage) consumePackage(row);
      row.status = "COMPLETED";
      row.queueStatus = "DONE";
      row.note = text;
      const visit = data.visits.find((v) => v.appointmentId === row.id && v.status === "IN_SERVICE");
      if (visit) {
        visit.status = "COMPLETED";
        visit.note = text;
        visit.completedAt = new Date().toISOString();
      }
      audit(user, "VISIT_COMPLETED", row.branchId, "appointment", row.id, "SUCCESS", correlationId);
      save();
      return publicAppointment(row);
    },

    undoVisit(user, id, correlationId) {
      if (user.role === "PATIENT") fail(403, "FORBIDDEN", "Patients cannot undo a visit.");
      const row = mustAppointment(user, id);
      if (row.status !== "IN_SERVICE") fail(409, "INVALID_STATE", "Only an in-service visit can be undone.");
      if (row.invoiceId) fail(409, "INVALID_STATE", "A billed visit cannot be undone.");
      row.status = "CHECKED_IN";
      row.queueStatus = "WAITING";
      const visit = data.visits.find((v) => v.appointmentId === row.id && v.status === "IN_SERVICE");
      if (visit) visit.status = "UNDONE";
      audit(user, "VISIT_UNDONE", row.branchId, "appointment", row.id, "SUCCESS", correlationId);
      save();
      return publicAppointment(row);
    },

    setPhysioStatus(user, physioId, status, correlationId) {
      if (!["ORG_ADMIN", "BRANCH_ADMIN", "PHYSIO"].includes(user.role)) fail(403, "FORBIDDEN", "You cannot change physiotherapist status.");
      if (!BASE_STATUS.has(status)) fail(400, "VALIDATION", "Choose a valid status.");
      const physio = physioOf(physioId);
      if (!physio) fail(404, "NOT_FOUND", "Physiotherapist not found.");
      if (user.role === "PHYSIO" && user.physioId !== physio.id) fail(403, "FORBIDDEN", "You can change only your own status.");
      if (user.role !== "ORG_ADMIN") assertBranch(user, physio.branchId);
      const active = data.appointments.some((a) => a.physioId === physio.id && a.status === "IN_SERVICE");
      if (active && status !== "AVAILABLE") fail(409, "PHYSIO_BUSY", "Finish the current session before leaving the board.");
      physio.availability = status;
      if (status === "OFF_DUTY" || status === "UNAVAILABLE") reassignFuture(user, physio, correlationId);
      audit(user, "PHYSIO_STATUS", physio.branchId, "physio", physio.id, "SUCCESS", correlationId);
      save();
      return { id: physio.id, availability: physio.availability, liveStatus: liveStatus(physio) };
    },

    consultSchedules(user) {
      if (!["ORG_ADMIN", "BRANCH_ADMIN", "PHYSIO"].includes(user.role)) fail(403, "FORBIDDEN", "Consultation hours are limited to the clinic team.");
      const visible = data.physios.filter((physio) => {
        if (user.role === "PHYSIO") return physio.id === user.physioId;
        if (user.role === "BRANCH_ADMIN") return (user.branchIds || []).includes(physio.branchId);
        return true;
      });
      return {
        physios: visible.map((physio) => ({
          id: physio.id,
          name: physio.name,
          specialty: physio.specialty,
          branchId: physio.branchId,
          branchName: branchOf(physio.branchId)?.name || "",
          consult: consultOf(physio),
          leave: leaveOf(physio),
          parallelTherapyCapacity: physio.parallelTherapyCapacity ?? "",
          effectiveCapacity: capacityFor(physio),
        })),
      };
    },

    updateConsult(user, physioId, body, correlationId) {
      if (!["ORG_ADMIN", "BRANCH_ADMIN", "PHYSIO"].includes(user.role)) fail(403, "FORBIDDEN", "You cannot change consultation hours.");
      const physio = physioOf(physioId);
      if (!physio) fail(404, "NOT_FOUND", "Physiotherapist not found.");
      if (user.role === "PHYSIO" && user.physioId !== physio.id) fail(403, "FORBIDDEN", "You can change only your own consultation hours.");
      if (user.role === "BRANCH_ADMIN" && !(user.branchIds || []).includes(physio.branchId)) fail(403, "FORBIDDEN", "You can change hours only at your branch.");
      const days = [...new Set((body.days || []).map(Number))].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
      if (!days.length) fail(400, "VALIDATION", "Choose at least one consultation day.", [{ field: "days", message: "Choose at least one day." }]);
      if (!/^\d{2}:\d{2}$/.test(body.start || "") || !/^\d{2}:\d{2}$/.test(body.end || "")) fail(400, "VALIDATION", "Enter a start and end time.");
      if (minutesOf(body.start) >= minutesOf(body.end)) fail(400, "VALIDATION", "Consultation end must be after the start.");
      const leave = (Array.isArray(body.leave) ? body.leave : []).map((item) => ({
        from: String(item.from || ""),
        to: String(item.to || ""),
        note: String(item.note || "Leave").slice(0, 80),
      })).filter((item) => item.from && item.to);
      if (leave.some((item) => !/^\d{4}-\d{2}-\d{2}$/.test(item.from) || !/^\d{4}-\d{2}-\d{2}$/.test(item.to) || item.from > item.to)) {
        fail(400, "VALIDATION", "Leave dates must be a valid range.");
      }
      physio.consult = { days, start: body.start, end: body.end };
      physio.leave = leave;
      if (["ORG_ADMIN", "BRANCH_ADMIN"].includes(user.role) && Object.prototype.hasOwnProperty.call(body, "parallelTherapyCapacity")) {
        if (body.parallelTherapyCapacity == null || body.parallelTherapyCapacity === "") delete physio.parallelTherapyCapacity;
        else {
          const capacity = Number(body.parallelTherapyCapacity);
          if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) fail(400, "VALIDATION", "Parallel therapy capacity must be from 1 to 20.");
          if (user.role === "BRANCH_ADMIN" && !(user.branchIds || []).includes(physio.branchId)) fail(403, "FORBIDDEN", "You can change capacity only at your branch.");
          physio.parallelTherapyCapacity = capacity;
        }
      }
      audit(user, "CONSULT_HOURS", physio.branchId, "physio", physio.id, "SUCCESS", correlationId);
      save();
      return { id: physio.id, consult: physio.consult, leave: physio.leave, parallelTherapyCapacity: physio.parallelTherapyCapacity ?? null };
    },

    listInvoices(user, branchId) {
      assertBranch(user, branchId);
      return data.invoices.filter((inv) => inv.branchId === branchId).sort((a, b) => b.postedAt.localeCompare(a.postedAt)).map(publicInvoice);
    },

    createInvoice(user, body, key, correlationId) {
      if (!["ORG_ADMIN", "BRANCH_ADMIN", "STAFF"].includes(user.role)) fail(403, "FORBIDDEN", "You cannot post invoices.");
      return idempotent(key, "invoice", body, () => {
        assertBranch(user, body.branchId);
        const patient = patientOf(body.patientId);
        if (!patient) fail(404, "NOT_FOUND", "Patient not found.");
        const requestedIds = [...new Set([...(Array.isArray(body.appointmentIds) ? body.appointmentIds : []), body.appointmentId].filter(Boolean))];
        const sessions = requestedIds.map((id) => {
          const appointment = data.appointments.find((row) => row.id === id);
          if (!appointment || appointment.patientId !== patient.id) fail(400, "VALIDATION", "Choose completed sessions for this patient.");
          if (appointment.branchId !== body.branchId) fail(400, "VALIDATION", "Sessions on one invoice must be at the same branch.");
          if (appointment.status !== "COMPLETED") fail(409, "INVALID_STATE", "Only a completed session can be invoiced.");
          if (appointment.invoiceId) fail(409, "ALREADY_BILLED", "One of these sessions already has an invoice.");
          return appointment;
        });
        const sourceLines = (body.lines || []).length ? body.lines : sessions.map((appointment) => ({ serviceId: appointment.serviceId, qty: appointment.slotCount || 1, appointmentId: appointment.id }));
        const lines = sourceLines.map((line) => {
          const service = serviceOf(line.serviceId);
          if (!service) fail(400, "VALIDATION", "Choose a valid service.");
          const qty = Number(line.qty || 1);
          if (!Number.isInteger(qty) || qty < 1) fail(400, "VALIDATION", "Quantity must be a whole number.");
          const unitPaise = priceFor(body.branchId, service.id);
          return { serviceId: service.id, name: service.name, qty, unitPaise, taxBps: data.organization.gstMode === "REGULAR" ? data.organization.gstBps : 0, appointmentId: line.appointmentId || null };
        });
        if (!lines.length) fail(400, "VALIDATION", "Add at least one service.");
        const discountBps = Number(body.discountBps || 0);
        if (!Number.isInteger(discountBps) || discountBps < 0) fail(400, "VALIDATION", "Discount is invalid.");
        if (discountBps > data.organization.discountCapBps) fail(400, "DISCOUNT_CAP", "Discount is above the configured cap.");
        const transactionId = String(body.transactionId || "").trim().slice(0, 80);
        const subtotalPaise = lines.reduce((sum, line) => sum + line.qty * line.unitPaise, 0);
        const discountPaise = percent(subtotalPaise, discountBps);
        const taxable = subtotalPaise - discountPaise;
        const taxPaise = data.organization.gstMode === "REGULAR" ? percent(taxable, data.organization.gstBps) : 0;
        const invoice = {
          id: crypto.randomUUID(),
          number: nextInvoiceNumber(body.branchId),
          branchId: body.branchId,
          patientId: patient.id,
          appointmentId: sessions[0]?.id || null,
          appointmentIds: sessions.map((appointment) => appointment.id),
          transactionId,
          status: "POSTED",
          gstMode: data.organization.gstMode,
          lines,
          discountBps,
          subtotalPaise,
          discountPaise,
          taxPaise,
          totalPaise: taxable + taxPaise,
          paidPaise: 0,
          postedAt: new Date().toISOString(),
        };
        data.invoices.push(invoice);
        sessions.forEach((appointment) => { appointment.invoiceId = invoice.id; });
        audit(user, "INVOICE_POSTED", invoice.branchId, "invoice", invoice.id, "SUCCESS", correlationId);
        save();
        return publicInvoice(invoice);
      });
    },

    updateInvoice(user, invoiceId, body, correlationId) {
      if (!["ORG_ADMIN", "BRANCH_ADMIN", "STAFF"].includes(user.role)) fail(403, "FORBIDDEN", "You cannot update an invoice.");
      const invoice = data.invoices.find((item) => item.id === invoiceId);
      if (!invoice) fail(404, "NOT_FOUND", "Invoice not found.");
      assertBranch(user, invoice.branchId);
      if (invoice.status === "CREDITED") fail(409, "INVALID_STATE", "A credited invoice cannot be edited.");
      invoice.transactionId = String(body.transactionId || "").trim().slice(0, 80);
      audit(user, "INVOICE_UPDATED", invoice.branchId, "invoice", invoice.id, "SUCCESS", correlationId);
      save();
      return publicInvoice(invoice);
    },

    pay(user, invoiceId, body, key, correlationId) {
      if (!["ORG_ADMIN", "BRANCH_ADMIN", "STAFF"].includes(user.role)) fail(403, "FORBIDDEN", "You cannot record payments.");
      return idempotent(key, `pay:${invoiceId}`, body, () => {
        const invoice = data.invoices.find((inv) => inv.id === invoiceId);
        if (!invoice) fail(404, "NOT_FOUND", "Invoice not found.");
        assertBranch(user, invoice.branchId);
        if (invoice.status !== "POSTED") fail(409, "INVALID_STATE", "Payments can only be recorded on a posted invoice.");
        const amountPaise = Number(body.amountPaise);
        if (!Number.isInteger(amountPaise) || amountPaise <= 0) fail(400, "VALIDATION", "Enter a payment amount in paise.");
        const due = invoice.totalPaise - invoice.paidPaise;
        if (amountPaise > due) fail(400, "OVERPAY", "Payment is higher than the amount due.");
        if (!activePaymentMethods().some((method) => method.code === body.method)) fail(400, "VALIDATION", "Choose an active payment method.");
        invoice.paidPaise += amountPaise;
        if (invoice.paidPaise === invoice.totalPaise) invoice.status = "PAID";
        data.payments.push({ id: crypto.randomUUID(), invoiceId: invoice.id, method: body.method, amountPaise, at: new Date().toISOString() });
        audit(user, "PAYMENT_RECORDED", invoice.branchId, "invoice", invoice.id, "SUCCESS", correlationId);
        save();
        return publicInvoice(invoice);
      });
    },

    creditNote(user, invoiceId, reason, correlationId) {
      if (user.role !== "ORG_ADMIN") fail(403, "FORBIDDEN", "Only an organization admin can issue a credit note.");
      const invoice = data.invoices.find((inv) => inv.id === invoiceId);
      if (!invoice) fail(404, "NOT_FOUND", "Invoice not found.");
      if (!["POSTED", "PAID"].includes(invoice.status)) fail(409, "INVALID_STATE", "This invoice cannot be credited.");
      if (!String(reason || "").trim()) fail(400, "VALIDATION", "Enter a reason for the credit note.");
      invoice.status = "CREDITED";
      const note = { id: crypto.randomUUID(), invoiceId, reason: String(reason).trim(), amountPaise: invoice.totalPaise, at: new Date().toISOString() };
      data.creditNotes.push(note);
      audit(user, "CREDIT_NOTE", invoice.branchId, "invoice", invoice.id, "SUCCESS", correlationId);
      save();
      return { creditNote: note, invoice: publicInvoice(invoice) };
    },

    listPackages(user, branchId) {
      if (user.role !== "PATIENT") assertBranch(user, branchId);
      const catalog = data.packages.map((pkg) => ({
        id: pkg.id,
        name: pkg.name,
        credits: pkg.credits,
        pricePaise: pkg.prices[branchId] ?? null,
      }));
      const owner = user.role === "PATIENT" ? user.patientId : null;
      const purchases = data.purchases
        .filter((p) => (owner ? p.patientId === owner : p.branchId === branchId))
        .map((p) => ({ ...p, packageName: data.packages.find((pkg) => pkg.id === p.packageId)?.name, patientName: data.patients.find((pt) => pt.id === p.patientId)?.name }));
      return { catalog, purchases };
    },

    purchasePackage(user, body, correlationId) {
      if (!["ORG_ADMIN", "BRANCH_ADMIN", "STAFF"].includes(user.role)) fail(403, "FORBIDDEN", "You cannot sell packages.");
      assertBranch(user, body.branchId);
      const patient = patientOf(body.patientId);
      const pkg = data.packages.find((p) => p.id === body.packageId);
      if (!patient || !pkg || pkg.prices[body.branchId] == null) fail(400, "VALIDATION", "Choose a patient and a package offered at this branch.");
      const purchase = {
        id: crypto.randomUUID(),
        patientId: patient.id,
        packageId: pkg.id,
        branchId: body.branchId,
        creditsTotal: pkg.credits,
        creditsLeft: pkg.credits,
        frozen: false,
        expiresOn: body.expiresOn || "2027-04-01",
        status: "ACTIVE",
      };
      data.purchases.push(purchase);
      audit(user, "PACKAGE_PURCHASED", body.branchId, "package", purchase.id, "SUCCESS", correlationId);
      save();
      return purchase;
    },

    setPackageFreeze(user, purchaseId, frozen, correlationId) {
      if (!["ORG_ADMIN", "BRANCH_ADMIN", "STAFF"].includes(user.role)) fail(403, "FORBIDDEN", "You cannot change a package.");
      const purchase = data.purchases.find((p) => p.id === purchaseId);
      if (!purchase) fail(404, "NOT_FOUND", "Package purchase not found.");
      assertBranch(user, purchase.branchId);
      purchase.frozen = Boolean(frozen);
      audit(user, frozen ? "PACKAGE_FROZEN" : "PACKAGE_UNFROZEN", purchase.branchId, "package", purchase.id, "SUCCESS", correlationId);
      save();
      return purchase;
    },

    listBranches(user) {
      assertAuth(user);
      if (!["ORG_ADMIN", "BRANCH_ADMIN"].includes(user.role)) fail(403, "FORBIDDEN", "Branch records are limited to administrators.");
      const visible = user.role === "ORG_ADMIN" ? data.branches : data.branches.filter((branch) => (user.branchIds || []).includes(branch.id));
      return {
        branches: visible.map((branch) => ({
          ...branch,
          admins: data.users
            .filter((account) => account.role === "BRANCH_ADMIN" && (account.branchIds || []).includes(branch.id))
            .map((account) => ({ id: account.id, name: account.name, email: account.email })),
        })),
        candidates: user.role === "ORG_ADMIN"
          ? data.users
            .filter((account) => ["STAFF", "BRANCH_ADMIN", "PHYSIO"].includes(account.role))
            .map((account) => ({ id: account.id, name: account.name, email: account.email, role: account.role, branchIds: account.branchIds || [] }))
          : [],
      };
    },

    addBranch(user, body, correlationId) {
      if (user.role !== "ORG_ADMIN") fail(403, "FORBIDDEN", "Only an organization admin can create a branch.");
      const name = String(body.name || "").trim();
      const code = String(body.code || "").trim().toUpperCase();
      const city = String(body.city || "").trim();
      const hours = String(body.hours || "08:00–20:00").trim() || "08:00–20:00";
      const fieldErrors = [];
      if (name.length < 2) fieldErrors.push({ field: "name", message: "Enter the branch name." });
      if (!/^[A-Z0-9-]{3,12}$/.test(code)) fieldErrors.push({ field: "code", message: "Use 3–12 letters, numbers, or hyphens." });
      if (city.length < 2) fieldErrors.push({ field: "city", message: "Enter the city." });
      if (data.branches.some((branch) => branch.code === code || branch.name.toLowerCase() === name.toLowerCase())) fieldErrors.push({ field: "code", message: "That branch name or code is already used." });
      if (fieldErrors.length) fail(400, "VALIDATION", "Check the highlighted fields.", fieldErrors);
      const id = `br-${code.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12)}`;
      if (data.branches.some((branch) => branch.id === id)) fail(400, "VALIDATION", "That branch code is already used.");
      const source = data.branches[0];
      const branch = { id, code, name, city, hours };
      data.branches.push(branch);
      if (source) {
        data.services.forEach((service) => {
          const price = data.prices[`${source.id}:${service.id}`];
          if (price != null) data.prices[`${branch.id}:${service.id}`] = price;
        });
        data.packages.forEach((pkg) => {
          if (pkg.prices?.[source.id] != null) pkg.prices[branch.id] = pkg.prices[source.id];
        });
      }
      data.users.filter((account) => account.role === "ORG_ADMIN").forEach((account) => {
        account.branchIds = [...new Set([...(account.branchIds || []), branch.id])];
      });
      audit(user, "BRANCH_CREATED", branch.id, "branch", branch.id, "SUCCESS", correlationId);
      save();
      return { branch };
    },

    assignBranchAdmin(user, body, correlationId) {
      if (user.role !== "ORG_ADMIN") fail(403, "FORBIDDEN", "Only an organization admin can assign a branch admin.");
      const account = data.users.find((item) => item.id === body.userId);
      if (!account || account.role === "PATIENT") fail(404, "NOT_FOUND", "Choose a clinic user.");
      if (account.role === "ORG_ADMIN") fail(403, "FORBIDDEN", "An organization admin already covers every branch.");
      const branchIds = [...new Set(Array.isArray(body.branchIds) ? body.branchIds.filter(Boolean) : [])];
      if (!branchIds.length || branchIds.some((id) => !branchOf(id))) fail(400, "VALIDATION", "Choose at least one branch.", [{ field: "branchIds", message: "Choose at least one branch." }]);
      account.role = "BRANCH_ADMIN";
      account.branchIds = branchIds;
      audit(user, "BRANCH_ADMIN_ASSIGNED", branchIds[0], "user", account.id, "SUCCESS", correlationId);
      save();
      return { id: account.id, name: account.name, email: account.email, role: account.role, branchIds };
    },

    addPhysio(user, body, correlationId) {
      if (!["ORG_ADMIN", "BRANCH_ADMIN"].includes(user.role)) fail(403, "FORBIDDEN", "You cannot add a physiotherapist.");
      return createClinician(user, { ...body, role: "PHYSIO" }, correlationId);
    },

    addEmployee(user, body, correlationId) {
      if (!["ORG_ADMIN", "BRANCH_ADMIN"].includes(user.role)) fail(403, "FORBIDDEN", "You cannot add an employee.");
      const role = body.role || "STAFF";
      if (user.role === "BRANCH_ADMIN" && !["STAFF", "PHYSIO"].includes(role)) fail(403, "FORBIDDEN", "A branch manager can add reception or a physiotherapist for this branch only.");
      if (!["STAFF", "PHYSIO", "BRANCH_ADMIN"].includes(role)) fail(400, "VALIDATION", "Choose reception, branch admin, or physiotherapist.");
      if (role === "BRANCH_ADMIN" && user.role !== "ORG_ADMIN") fail(403, "FORBIDDEN", "Only an organization admin can add a branch manager.");
      return createClinician(user, { ...body, role }, correlationId);
    },

    catalog(user) {
      if (!["ORG_ADMIN", "BRANCH_ADMIN"].includes(user.role)) fail(403, "FORBIDDEN", "Catalog settings are limited to administrators.");
      const branches = user.role === "ORG_ADMIN" ? data.branches : data.branches.filter((branch) => user.branchIds.includes(branch.id));
      const services = data.services.map((service) => ({
        ...service,
        prices: branches.map((branch) => ({ branchId: branch.id, branchName: branch.name, pricePaise: data.prices[`${branch.id}:${service.id}`] ?? null })),
      }));
      const packages = data.packages.map((pkg) => ({
        id: pkg.id,
        name: pkg.name,
        credits: pkg.credits,
        active: pkg.active !== false,
        categoryId: pkg.categoryId || "cat-package",
        prices: branches.map((branch) => ({ branchId: branch.id, branchName: branch.name, pricePaise: pkg.prices[branch.id] ?? null })),
      }));
      return {
        services,
        packages,
        branches,
        categories: data.categories,
        paymentMethods: data.paymentMethods,
        booking: data.bookingConfig,
      };
    },

    addService(user, body, correlationId) {
      const targets = catalogTargets(user, body);
      const name = String(body.name || "").trim();
      const pricePaise = rupeesToPaise(body.priceRupees);
      const kind = body.kind === "CONSULT" ? "CONSULT" : "THERAPY";
      const duration = readDurationConfig(body, kind, body.slotMin != null || body.maxSlots != null);
      if (name.length < 2) fail(400, "VALIDATION", "Enter a service name.", [{ field: "name", message: "Enter a service name." }]);
      const service = { id: `svc-${crypto.randomUUID().slice(0, 8)}`, name, kind, active: true, categoryId: kind === "CONSULT" ? "cat-consult" : "cat-therapy", ...duration };
      data.services.push(service);
      targets.forEach((branch) => { data.prices[`${branch.id}:${service.id}`] = pricePaise; });
      audit(user, "SERVICE_CREATED", targets[0].id, "service", service.id, "SUCCESS", correlationId);
      save();
      return service;
    },

    updateService(user, serviceId, body, correlationId) {
      if (user.role !== "ORG_ADMIN") fail(403, "FORBIDDEN", "Only an organization admin can change therapy duration and type.");
      const service = serviceOf(serviceId);
      if (!service) fail(404, "NOT_FOUND", "Service not found.");
      if (body.name) service.name = String(body.name).trim();
      if (body.kind === "CONSULT" || body.kind === "THERAPY") service.kind = body.kind;
      if (body.active != null) service.active = Boolean(body.active);
      if (body.slotMin != null || body.maxSlots != null || body.minDurationMin != null || body.durationStepMin != null || body.maxDurationMin != null || body.durationMin != null) {
        const explicit = body.slotMin != null || body.maxSlots != null;
        Object.assign(service, readDurationConfig(explicit ? body : { ...service, ...body }, service.kind, explicit));
      }
      normalizeService(service);
      audit(user, "SERVICE_UPDATED", null, "service", service.id, "SUCCESS", correlationId);
      save();
      return service;
    },

    updateBookingConfig(user, body, correlationId) {
      if (user.role !== "ORG_ADMIN") fail(403, "FORBIDDEN", "Only an organization admin can set the default therapy capacity.");
      const capacity = Number(body.parallelTherapyCapacity);
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) fail(400, "VALIDATION", "Parallel therapy capacity must be from 1 to 20.");
      data.bookingConfig.parallelTherapyCapacity = capacity;
      audit(user, "BOOKING_CONFIG", null, "organization", data.organization.id, "SUCCESS", correlationId);
      save();
      return data.bookingConfig;
    },

    updateBranchCapacity(user, branchId, body, correlationId) {
      if (!["ORG_ADMIN", "BRANCH_ADMIN"].includes(user.role)) fail(403, "FORBIDDEN", "You cannot change branch capacity.");
      const branch = branchOf(branchId);
      if (!branch) fail(404, "NOT_FOUND", "Branch not found.");
      if (user.role !== "ORG_ADMIN") assertBranch(user, branchId);
      if (body.parallelTherapyCapacity == null || body.parallelTherapyCapacity === "") {
        delete branch.parallelTherapyCapacity;
      } else {
        const capacity = Number(body.parallelTherapyCapacity);
        if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) fail(400, "VALIDATION", "Parallel therapy capacity must be from 1 to 20.");
        branch.parallelTherapyCapacity = capacity;
      }
      audit(user, "BRANCH_CAPACITY", branch.id, "branch", branch.id, "SUCCESS", correlationId);
      save();
      return { id: branch.id, parallelTherapyCapacity: branch.parallelTherapyCapacity ?? null };
    },

    addPaymentMethod(user, body, correlationId) {
      if (user.role !== "ORG_ADMIN") fail(403, "FORBIDDEN", "Only an organization admin can add a payment method.");
      const name = String(body.name || "").trim();
      const code = String(body.code || "").trim().toUpperCase();
      if (name.length < 2 || !/^[A-Z0-9_]{2,12}$/.test(code)) fail(400, "VALIDATION", "Enter a name and a short code.");
      if (data.paymentMethods.some((method) => method.code === code)) fail(400, "VALIDATION", "That payment code is already used.");
      const method = { id: `pm-${crypto.randomUUID().slice(0, 8)}`, code, name, active: true };
      data.paymentMethods.push(method);
      audit(user, "PAYMENT_METHOD_CREATED", null, "paymentMethod", method.id, "SUCCESS", correlationId);
      save();
      return method;
    },

    updatePaymentMethod(user, methodId, body, correlationId) {
      if (user.role !== "ORG_ADMIN") fail(403, "FORBIDDEN", "Only an organization admin can change payment methods.");
      const method = data.paymentMethods.find((item) => item.id === methodId);
      if (!method) fail(404, "NOT_FOUND", "Payment method not found.");
      if (body.name) method.name = String(body.name).trim();
      if (body.active != null) method.active = Boolean(body.active);
      audit(user, "PAYMENT_METHOD_UPDATED", null, "paymentMethod", method.id, "SUCCESS", correlationId);
      save();
      return method;
    },

    addCategory(user, body, correlationId) {
      if (user.role !== "ORG_ADMIN") fail(403, "FORBIDDEN", "Only an organization admin can add a category.");
      const name = String(body.name || "").trim();
      const kind = ["CONSULT", "THERAPY", "PACKAGE"].includes(body.kind) ? body.kind : "THERAPY";
      if (name.length < 2) fail(400, "VALIDATION", "Enter a category name.");
      const category = { id: `cat-${crypto.randomUUID().slice(0, 8)}`, name, kind, active: true };
      data.categories.push(category);
      audit(user, "CATEGORY_CREATED", null, "category", category.id, "SUCCESS", correlationId);
      save();
      return category;
    },

    updateCategory(user, categoryId, body, correlationId) {
      if (user.role !== "ORG_ADMIN") fail(403, "FORBIDDEN", "Only an organization admin can change a category.");
      const category = data.categories.find((item) => item.id === categoryId);
      if (!category) fail(404, "NOT_FOUND", "Category not found.");
      if (body.active === false) {
        const used = data.services.some((service) => service.categoryId === category.id) || data.packages.some((pkg) => pkg.categoryId === category.id);
        if (used && body.remove) fail(409, "IN_USE", "This category is used by existing records and cannot be removed.");
      }
      if (body.name) category.name = String(body.name).trim();
      if (body.active != null) category.active = Boolean(body.active);
      audit(user, "CATEGORY_UPDATED", null, "category", category.id, "SUCCESS", correlationId);
      save();
      return category;
    },

    addPackageDefinition(user, body, correlationId) {
      const targets = catalogTargets(user, body);
      const name = String(body.name || "").trim();
      const credits = Number(body.credits);
      const pricePaise = rupeesToPaise(body.priceRupees);
      if (name.length < 2) fail(400, "VALIDATION", "Enter a package name.");
      if (!Number.isInteger(credits) || credits < 1) fail(400, "VALIDATION", "Credits must be a whole number.");
      const pkg = { id: `pkg-${crypto.randomUUID().slice(0, 8)}`, name, credits, active: true, categoryId: "cat-package", prices: {} };
      targets.forEach((branch) => { pkg.prices[branch.id] = pricePaise; });
      data.packages.push(pkg);
      audit(user, "PACKAGE_DEFINED", targets[0].id, "package", pkg.id, "SUCCESS", correlationId);
      save();
      return pkg;
    },

    listStaff(user, branchId) {
      if (!["ORG_ADMIN", "BRANCH_ADMIN"].includes(user.role)) fail(403, "FORBIDDEN", "Staff records are limited to administrators.");
      assertBranch(user, branchId);
      const people = data.users.filter((u) => u.branchIds.includes(branchId) || u.role === "ORG_ADMIN").map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        engagement: u.physioId ? physioOf(u.physioId)?.engagement : null,
        specialty: u.physioId ? physioOf(u.physioId)?.specialty : null,
        phone: u.phone || physioOf(u.physioId)?.phone || "",
        termsAccepted: u.termsAccepted,
      }));
      const roster = data.physios.filter((p) => p.branchId === branchId).map((p) => ({
        id: p.id,
        name: p.name,
        engagement: p.engagement,
        specialty: p.specialty,
        liveStatus: liveStatus(p),
        availability: p.availability,
        email: p.email || "",
        phone: p.phone || "",
        experienceYears: p.experienceYears ?? null,
        gender: p.gender || "",
      }));
      return { people, roster };
    },

    reports(user, branchId) {
      if (!["ORG_ADMIN", "BRANCH_ADMIN"].includes(user.role)) fail(403, "FORBIDDEN", "Reports are limited to administrators.");
      const month = todayKey().slice(0, 7);
      const branches = branchId === "all" ? (user.role === "ORG_ADMIN" ? data.branches : fail(403, "FORBIDDEN", "Branch comparison is organization-wide.")) : [branchOf(branchId)];
      if (branchId !== "all") assertBranch(user, branchId);
      const byBranch = branches.filter(Boolean).map((branch) => {
        const completed = data.appointments.filter((a) => a.branchId === branch.id && a.status === "COMPLETED" && dayKey(a.start).startsWith(month));
        const physioRows = data.physios.filter((p) => p.branchId === branch.id).map((p) => {
          const sessions = completed.filter((a) => a.physioId === p.id).length;
          return { id: p.id, name: p.name, engagement: p.engagement, sessions, rating: p.reviewCount ? Math.round((p.ratingSum / p.reviewCount) * 10) / 10 : null, reviewCount: p.reviewCount };
        });
        const dues = data.invoices.filter((inv) => inv.branchId === branch.id && inv.status === "POSTED").reduce((sum, inv) => sum + inv.totalPaise - inv.paidPaise, 0);
        return {
          branchId: branch.id,
          branchName: branch.name,
          consultationsMtd: completed.length,
          employeeSessions: physioRows.filter((p) => p.engagement === "EMPLOYEE").reduce((s, p) => s + p.sessions, 0),
          consultantSessions: physioRows.filter((p) => p.engagement === "CONSULTANT").reduce((s, p) => s + p.sessions, 0),
          duesPaise: dues,
          physios: physioRows,
          invoices: data.invoices.filter((invoice) => invoice.branchId === branch.id).map((invoice) => ({
            id: invoice.id,
            number: invoice.number,
            transactionId: invoice.transactionId || "",
            totalPaise: invoice.totalPaise,
            status: invoice.status,
          })),
        };
      });
      audit(user, "REPORT_READ", branchId === "all" ? null : branchId, "report", month, "SUCCESS");
      save();
      return { month, branches: byBranch };
    },

    listNotifications(user, branchId) {
      if (user.role === "PATIENT") fail(403, "FORBIDDEN", "Notification operations are for clinic staff.");
      assertBranch(user, branchId);
      return data.notifications.filter((n) => n.branchId === branchId).map((n) => ({
        ...n,
        patientName: data.patients.find((p) => p.id === n.patientId)?.name || "",
        patientCode: data.patients.find((p) => p.id === n.patientId)?.code || "",
      }));
    },

    retryNotification(user, id, correlationId) {
      if (!["ORG_ADMIN", "BRANCH_ADMIN", "STAFF"].includes(user.role)) fail(403, "FORBIDDEN", "You cannot retry notifications.");
      const note = data.notifications.find((n) => n.id === id);
      if (!note) fail(404, "NOT_FOUND", "Notification not found.");
      assertBranch(user, note.branchId);
      note.attempts += 1;
      note.status = "SENT";
      note.lastError = "";
      audit(user, "NOTIFICATION_RETRIED", note.branchId, "notification", note.id, "SUCCESS", correlationId);
      save();
      return note;
    },

    listAudit(user, branchId) {
      if (!["ORG_ADMIN", "BRANCH_ADMIN"].includes(user.role)) fail(403, "FORBIDDEN", "The audit log is limited to administrators.");
      if (branchId !== "all") assertBranch(user, branchId);
      if (branchId === "all" && user.role !== "ORG_ADMIN") fail(403, "FORBIDDEN", "Organization audit is limited to the organization admin.");
      return data.audit.filter((e) => branchId === "all" || e.branchId === branchId).slice(0, 100);
    },

    getFlags(user) {
      assertAuth(user);
      return data.flags;
    },

    updateFlags(user, body, correlationId) {
      if (user.role !== "ORG_ADMIN") fail(403, "FORBIDDEN", "Only an organization admin can change feature flags.");
      if (typeof body.patientBooking === "boolean") data.flags.patientBooking = body.patientBooking;
      if (typeof body.publicRatings === "boolean") data.flags.publicRatings = body.publicRatings;
      audit(user, "FLAGS_UPDATED", null, "flags", "org", "SUCCESS", correlationId);
      save();
      return data.flags;
    },

    feedback(user, body, correlationId) {
      if (user.role !== "PATIENT") fail(403, "FORBIDDEN", "Only a patient can leave session feedback.");
      if (!data.flags.publicRatings) fail(403, "FEATURE_DISABLED", "Public ratings are turned off.");
      const row = data.appointments.find((a) => a.id === body.appointmentId && a.patientId === user.patientId);
      if (!row) fail(404, "NOT_FOUND", "Appointment not found.");
      if (row.status !== "COMPLETED") fail(409, "INVALID_STATE", "Rate a visit after it is completed.");
      if (data.feedback.some((f) => f.appointmentId === row.id)) fail(409, "DUPLICATE_FEEDBACK", "This visit already has feedback.");
      const rating = Number(body.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) fail(400, "VALIDATION", "Choose a rating from 1 to 5.");
      const entry = { id: crypto.randomUUID(), appointmentId: row.id, patientId: user.patientId, physioId: row.physioId, rating, comment: String(body.comment || "").slice(0, 400), at: new Date().toISOString() };
      data.feedback.push(entry);
      const physio = physioOf(row.physioId);
      physio.ratingSum += rating;
      physio.reviewCount += 1;
      audit(user, "FEEDBACK", row.branchId, "appointment", row.id, "SUCCESS", correlationId);
      save();
      return entry;
    },
  };

  function clinicalFrom(body, current = {}) {
    const text = (key) => (body[key] === undefined ? (current[key] || "") : String(body[key] || "").trim());
    let painScore = current.painScore ?? null;
    if (body.painScore !== undefined && body.painScore !== "") {
      const score = Number(body.painScore);
      if (!Number.isInteger(score) || score < 0 || score > 10) return { painScore: "invalid" };
      painScore = score;
    }
    if (body.painScore === "") painScore = null;
    let emergencyPhone = current.emergencyPhone || "";
    if (body.emergencyPhone !== undefined) {
      const phone = String(body.emergencyPhone || "").replace(/\D/g, "");
      if (phone && !/^\d{10}$/.test(phone)) return { emergencyPhone: "invalid" };
      emergencyPhone = phone;
    }
    return {
      email: text("email"),
      address: text("address"),
      emergencyName: text("emergencyName"),
      emergencyPhone,
      occupation: text("occupation"),
      bloodGroup: text("bloodGroup"),
      referringDoctor: text("referringDoctor"),
      condition: text("condition"),
      affectedArea: text("affectedArea"),
      painScore,
      onset: text("onset"),
      precautions: text("precautions"),
    };
  }

  function rupeesToPaise(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) fail(400, "VALIDATION", "Enter a valid price in rupees.");
    return Math.round(amount * 100);
  }

  function catalogTargets(user, body) {
    if (!["ORG_ADMIN", "BRANCH_ADMIN"].includes(user.role)) fail(403, "FORBIDDEN", "You cannot change the catalog.");
    if (user.role === "BRANCH_ADMIN") {
      const requested = body.branchId && (user.branchIds || []).includes(body.branchId) ? body.branchId : user.branchIds?.[0];
      const branch = branchOf(requested);
      if (!branch) fail(400, "BRANCH_REQUIRED", "Choose a branch.");
      return [branch];
    }
    if (body.applyAll === false && body.branchId) {
      const branch = branchOf(body.branchId);
      if (!branch) fail(400, "VALIDATION", "Choose a branch.");
      return [branch];
    }
    return data.branches;
  }

  function createClinician(user, body, correlationId) {
    const branchId = body.branchId || user.branchIds?.[0];
    let assigned = [branchId];
    if (body.role === "BRANCH_ADMIN" && user.role === "ORG_ADMIN" && Array.isArray(body.branchIds) && body.branchIds.filter(Boolean).length) {
      assigned = [...new Set(body.branchIds.filter(Boolean))];
    }
    if (user.role !== "ORG_ADMIN") assertBranch(user, branchId);
    else if (!assigned.every((id) => branchOf(id))) fail(400, "VALIDATION", "Choose a branch.");
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").replace(/\D/g, "");
    const fieldErrors = [];
    if (name.length < 2) fieldErrors.push({ field: "name", message: "Enter a name." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.push({ field: "email", message: "Enter a work email." });
    if (phone && !/^\d{10}$/.test(phone)) fieldErrors.push({ field: "phone", message: "Enter a 10-digit mobile number." });
    if (data.users.some((account) => account.email === email)) fieldErrors.push({ field: "email", message: "That email is already used." });
    const role = body.role;
    const engagement = body.engagement === "CONSULTANT" ? "CONSULTANT" : "EMPLOYEE";
    const specialty = String(body.specialty || "").trim();
    if (role === "PHYSIO" && specialty.length < 2) fieldErrors.push({ field: "specialty", message: "Enter a specialty." });
    if (fieldErrors.length) fail(400, "VALIDATION", "Check the highlighted fields.", fieldErrors);
    const experienceYears = body.experienceYears === "" || body.experienceYears == null ? null : Number(body.experienceYears);
    const accountId = crypto.randomUUID();
    let physioId = null;
    if (role === "PHYSIO") {
      physioId = crypto.randomUUID();
      data.physios.push({
        id: physioId,
        name,
        engagement,
        specialty,
        branchId,
        availability: "AVAILABLE",
        consult: { ...DEFAULT_CONSULT, days: [...DEFAULT_CONSULT.days] },
        leave: [],
        ratingSum: 0,
        reviewCount: 0,
        gender: body.gender || "",
        phone,
        email,
        experienceYears: Number.isInteger(experienceYears) ? experienceYears : null,
      });
    }
    data.users.push({
      id: accountId,
      name,
      email,
      phone,
      role,
      branchIds: assigned,
      physioId,
      password: hashPassword("HealthWise#2026"),
      termsAccepted: false,
    });
    audit(user, role === "PHYSIO" ? "PHYSIO_CREATED" : "EMPLOYEE_CREATED", branchId, "user", accountId, "SUCCESS", correlationId);
    save();
    return { id: accountId, physioId, name, email, role, branchId, temporaryPassword: "HealthWise#2026" };
  }

  function priceForSafe(branchId, serviceId) {
    return data.prices[`${branchId}:${serviceId}`] ?? null;
  }

  function publicInvoice(invoice) {
    const patient = data.patients.find((p) => p.id === invoice.patientId);
    return {
      ...invoice,
      patientName: patient?.name || "",
      patientCode: patient?.code || "",
      duePaise: invoice.status === "CREDITED" ? 0 : invoice.totalPaise - invoice.paidPaise,
    };
  }

  function mustAppointment(user, id) {
    assertAuth(user);
    const row = data.appointments.find((a) => a.id === id);
    if (!row) fail(404, "NOT_FOUND", "Appointment not found.");
    if (user.role === "PATIENT" && row.patientId !== user.patientId) fail(403, "FORBIDDEN", "That appointment belongs to another profile.");
    if (user.role !== "PATIENT" && user.role !== "ORG_ADMIN") assertBranch(user, row.branchId);
    if (user.role === "PHYSIO" && row.physioId !== user.physioId && user.physioId) {
      /* physio may view branch board through other endpoints; mutations checked by callers */
    }
    return row;
  }

  function assertPolicyWindow(user, row) {
    if (user.role !== "PATIENT") return;
    const hours = (new Date(row.start).getTime() - Date.now()) / 3600000;
    if (hours < 2) fail(409, "POLICY_WINDOW", "Online changes close 2 hours before the appointment. Call the clinic.");
  }

  function consumePackage(row) {
    if (row.packageConsumed) return;
    const purchase = data.purchases.find((p) => p.patientId === row.patientId && p.status === "ACTIVE" && !p.frozen && p.creditsLeft > 0);
    if (!purchase) fail(409, "NO_PACKAGE_CREDIT", "No active package credit is available.");
    purchase.creditsLeft -= 1;
    row.packageConsumed = true;
  }
}

export function openStore(file, options = {}) {
  if (file && fs.existsSync(file)) {
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    return createStore({ ...options, data: saved, file });
  }
  const store = createStore({ ...options, file });
  store.save();
  return store;
}
