import express from "express";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { HttpError, openStore } from "./store.js";
import { openMysqlStore } from "./mysql.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 8080);
const dataFile = process.env.DATA_FILE || path.join(root, "data", "state.json");

const databaseUrl = process.env.DATABASE_URL || "";
const store = databaseUrl
  ? await openMysqlStore({
    url: databaseUrl,
    file: dataFile,
    mfaCode: process.env.DEMO_MFA_CODE || "246810",
    otpCode: process.env.DEMO_OTP_CODE || "482910",
  })
  : openStore(dataFile, {
    mfaCode: process.env.DEMO_MFA_CODE || "246810",
    otpCode: process.env.DEMO_OTP_CODE || "482910",
  });

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  const incoming = req.get("x-correlation-id");
  req.correlationId = incoming && incoming.length < 80 ? incoming : crypto.randomUUID();
  res.setHeader("x-correlation-id", req.correlationId);
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("referrer-policy", "no-referrer");
  res.setHeader("x-frame-options", "SAMEORIGIN");
  next();
});

function userFrom(req) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token ? store.sessionUser(token) : null;
}

function branchFrom(req, user) {
  return req.query.branchId || req.body?.branchId || user?.branchIds?.[0] || null;
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "ok", service: "physio-healthwise", database: store.driver || "json", time: new Date().toISOString() });
});

app.get("/api/v1/ready", (_req, res) => {
  res.json({ status: "ready", data: Boolean(store.data?.branches?.length) });
});

app.post("/api/v1/auth/login", asyncRoute(async (req, res) => {
  res.json(store.login(req.body?.email, req.body?.password));
}));

app.post("/api/v1/auth/mfa", asyncRoute(async (req, res) => {
  res.json(store.verifyMfa(req.body?.challengeId, req.body?.code));
}));

app.post("/api/v1/auth/logout", asyncRoute(async (req, res) => {
  const header = req.get("authorization") || "";
  store.logout(header.startsWith("Bearer ") ? header.slice(7) : "");
  res.json({ ok: true });
}));

app.get("/api/v1/auth/sessions", asyncRoute(async (req, res) => {
  res.json({ sessions: store.listSessions(userFrom(req)) });
}));

app.post("/api/v1/auth/sessions/:id/revoke", asyncRoute(async (req, res) => {
  res.json(store.revokeSession(userFrom(req), req.params.id));
}));

app.post("/api/v1/portal/otp/request", asyncRoute(async (req, res) => {
  res.json(store.requestOtp(req.body?.phone));
}));

app.post("/api/v1/portal/otp/verify", asyncRoute(async (req, res) => {
  res.json(store.verifyOtp(req.body?.challengeId, req.body?.code, req.body?.patientId));
}));

app.get("/api/v1/me", asyncRoute(async (req, res) => {
  const user = userFrom(req);
  if (!user) throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
  res.json({ user });
}));

app.get("/api/v1/bootstrap", asyncRoute(async (req, res) => {
  const user = userFrom(req);
  res.json(store.bootstrap(user, branchFrom(req, user)));
}));

app.get("/api/v1/dashboard", asyncRoute(async (req, res) => {
  const user = userFrom(req);
  res.json(store.dashboard(user, branchFrom(req, user)));
}));

app.get("/api/v1/patients", asyncRoute(async (req, res) => {
  const user = userFrom(req);
  res.json({ patients: store.searchPatients(user, req.query.q || "", branchFrom(req, user)) });
}));

app.post("/api/v1/patients", asyncRoute(async (req, res) => {
  res.status(201).json(store.createPatient(userFrom(req), req.body || {}, req.correlationId));
}));

app.patch("/api/v1/patients/:id", asyncRoute(async (req, res) => {
  res.json(store.updatePatient(userFrom(req), req.params.id, req.body || {}, req.correlationId));
}));

app.get("/api/v1/patients/:id", asyncRoute(async (req, res) => {
  res.json(store.getPatient(userFrom(req), req.params.id));
}));

app.post("/api/v1/patients/:id/reveal-phone", asyncRoute(async (req, res) => {
  res.json(store.revealPhone(userFrom(req), req.params.id, req.correlationId));
}));

app.post("/api/v1/patients/merge", asyncRoute(async (req, res) => {
  res.json(store.mergePatients(userFrom(req), req.body?.sourceId, req.body?.targetId, req.correlationId));
}));

app.get("/api/v1/patients/:id/export", asyncRoute(async (req, res) => {
  res.json(store.exportPatient(userFrom(req), req.params.id));
}));

app.get("/api/v1/availability", asyncRoute(async (req, res) => {
  res.json(store.availability(userFrom(req), req.query));
}));

app.get("/api/v1/appointments", asyncRoute(async (req, res) => {
  const user = userFrom(req);
  res.json({ appointments: store.listAppointments(user, branchFrom(req, user), req.query.date || "") });
}));

app.post("/api/v1/appointments", asyncRoute(async (req, res) => {
  res.status(201).json(store.book(userFrom(req), req.body || {}, req.get("idempotency-key"), req.correlationId));
}));

app.post("/api/v1/appointments/:id/check-in", asyncRoute(async (req, res) => {
  res.json(store.checkIn(userFrom(req), req.params.id, req.correlationId));
}));

app.post("/api/v1/appointments/:id/cancel", asyncRoute(async (req, res) => {
  res.json(store.cancel(userFrom(req), req.params.id, req.body?.reasonCode, req.correlationId));
}));

app.post("/api/v1/appointments/:id/reschedule", asyncRoute(async (req, res) => {
  res.json(store.reschedule(userFrom(req), req.params.id, req.body?.start, req.body?.reasonCode, req.correlationId));
}));

app.post("/api/v1/appointments/:id/no-show", asyncRoute(async (req, res) => {
  res.json(store.noShow(userFrom(req), req.params.id, req.correlationId));
}));

app.post("/api/v1/queue/walk-in", asyncRoute(async (req, res) => {
  res.status(201).json(store.walkIn(userFrom(req), req.body || {}, req.correlationId));
}));

app.post("/api/v1/visits/:id/start", asyncRoute(async (req, res) => {
  res.json(store.startVisit(userFrom(req), req.params.id, req.correlationId));
}));

app.post("/api/v1/visits/:id/complete", asyncRoute(async (req, res) => {
  res.json(store.completeVisit(userFrom(req), req.params.id, req.body?.note, Boolean(req.body?.usePackage), req.correlationId));
}));

app.post("/api/v1/visits/:id/undo", asyncRoute(async (req, res) => {
  res.json(store.undoVisit(userFrom(req), req.params.id, req.correlationId));
}));

app.post("/api/v1/physios", asyncRoute(async (req, res) => {
  res.status(201).json(store.addPhysio(userFrom(req), req.body || {}, req.correlationId));
}));

app.post("/api/v1/employees", asyncRoute(async (req, res) => {
  res.status(201).json(store.addEmployee(userFrom(req), req.body || {}, req.correlationId));
}));

app.get("/api/v1/branches", asyncRoute(async (req, res) => {
  res.json(store.listBranches(userFrom(req)));
}));

app.post("/api/v1/branches", asyncRoute(async (req, res) => {
  res.status(201).json(store.addBranch(userFrom(req), req.body || {}, req.correlationId));
}));

app.post("/api/v1/branches/admins", asyncRoute(async (req, res) => {
  res.json(store.assignBranchAdmin(userFrom(req), req.body || {}, req.correlationId));
}));

app.get("/api/v1/catalog", asyncRoute(async (req, res) => {
  res.json(store.catalog(userFrom(req)));
}));

app.patch("/api/v1/invoices/:id", asyncRoute(async (req, res) => {
  res.json(store.updateInvoice(userFrom(req), req.params.id, req.body || {}, req.correlationId));
}));

app.post("/api/v1/services", asyncRoute(async (req, res) => {
  res.status(201).json(store.addService(userFrom(req), req.body || {}, req.correlationId));
}));

app.patch("/api/v1/services/:id", asyncRoute(async (req, res) => {
  res.json(store.updateService(userFrom(req), req.params.id, req.body || {}, req.correlationId));
}));

app.patch("/api/v1/booking-config", asyncRoute(async (req, res) => {
  res.json(store.updateBookingConfig(userFrom(req), req.body || {}, req.correlationId));
}));

app.patch("/api/v1/branches/:id/capacity", asyncRoute(async (req, res) => {
  res.json(store.updateBranchCapacity(userFrom(req), req.params.id, req.body || {}, req.correlationId));
}));

app.post("/api/v1/categories", asyncRoute(async (req, res) => {
  res.status(201).json(store.addCategory(userFrom(req), req.body || {}, req.correlationId));
}));

app.patch("/api/v1/categories/:id", asyncRoute(async (req, res) => {
  res.json(store.updateCategory(userFrom(req), req.params.id, req.body || {}, req.correlationId));
}));

app.post("/api/v1/payment-methods", asyncRoute(async (req, res) => {
  res.status(201).json(store.addPaymentMethod(userFrom(req), req.body || {}, req.correlationId));
}));

app.patch("/api/v1/payment-methods/:id", asyncRoute(async (req, res) => {
  res.json(store.updatePaymentMethod(userFrom(req), req.params.id, req.body || {}, req.correlationId));
}));

app.post("/api/v1/packages/definitions", asyncRoute(async (req, res) => {
  res.status(201).json(store.addPackageDefinition(userFrom(req), req.body || {}, req.correlationId));
}));

app.get("/api/v1/consult-schedules", asyncRoute(async (req, res) => {
  res.json(store.consultSchedules(userFrom(req)));
}));

app.patch("/api/v1/physios/:id/consult", asyncRoute(async (req, res) => {
  res.json(store.updateConsult(userFrom(req), req.params.id, req.body || {}, req.correlationId));
}));

app.post("/api/v1/physios/:id/status", asyncRoute(async (req, res) => {
  res.json(store.setPhysioStatus(userFrom(req), req.params.id, req.body?.status, req.correlationId));
}));

app.get("/api/v1/invoices", asyncRoute(async (req, res) => {
  const user = userFrom(req);
  res.json({ invoices: store.listInvoices(user, branchFrom(req, user)) });
}));

app.post("/api/v1/invoices", asyncRoute(async (req, res) => {
  res.status(201).json(store.createInvoice(userFrom(req), req.body || {}, req.get("idempotency-key"), req.correlationId));
}));

app.post("/api/v1/invoices/:id/payments", asyncRoute(async (req, res) => {
  res.json(store.pay(userFrom(req), req.params.id, req.body || {}, req.get("idempotency-key"), req.correlationId));
}));

app.post("/api/v1/invoices/:id/credit-note", asyncRoute(async (req, res) => {
  res.json(store.creditNote(userFrom(req), req.params.id, req.body?.reason, req.correlationId));
}));

app.get("/api/v1/packages", asyncRoute(async (req, res) => {
  const user = userFrom(req);
  res.json(store.listPackages(user, branchFrom(req, user)));
}));

app.post("/api/v1/packages/purchase", asyncRoute(async (req, res) => {
  res.status(201).json(store.purchasePackage(userFrom(req), req.body || {}, req.correlationId));
}));

app.post("/api/v1/packages/:id/freeze", asyncRoute(async (req, res) => {
  res.json(store.setPackageFreeze(userFrom(req), req.params.id, req.body?.frozen !== false, req.correlationId));
}));

app.get("/api/v1/staff", asyncRoute(async (req, res) => {
  const user = userFrom(req);
  res.json(store.listStaff(user, branchFrom(req, user)));
}));

app.get("/api/v1/reports", asyncRoute(async (req, res) => {
  const user = userFrom(req);
  res.json(store.reports(user, req.query.branchId || branchFrom(req, user)));
}));

app.get("/api/v1/notifications", asyncRoute(async (req, res) => {
  const user = userFrom(req);
  res.json({ notifications: store.listNotifications(user, branchFrom(req, user)) });
}));

app.post("/api/v1/notifications/:id/retry", asyncRoute(async (req, res) => {
  res.json(store.retryNotification(userFrom(req), req.params.id, req.correlationId));
}));

app.get("/api/v1/audit", asyncRoute(async (req, res) => {
  const user = userFrom(req);
  res.json({ events: store.listAudit(user, req.query.branchId || branchFrom(req, user)) });
}));

app.get("/api/v1/flags", asyncRoute(async (req, res) => {
  res.json(store.getFlags(userFrom(req)));
}));

app.patch("/api/v1/flags", asyncRoute(async (req, res) => {
  res.json(store.updateFlags(userFrom(req), req.body || {}, req.correlationId));
}));

app.post("/api/v1/feedback", asyncRoute(async (req, res) => {
  res.status(201).json(store.feedback(userFrom(req), req.body || {}, req.correlationId));
}));

app.use(express.static(path.join(root, "public")));
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(root, "public", "index.html"));
});

app.use((err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, correlationId: req.correlationId, fieldErrors: err.fieldErrors || [] },
    });
    return;
  }
  console.error(JSON.stringify({ level: "error", correlationId: req.correlationId, message: err.message }));
  res.status(500).json({
    error: { code: "INTERNAL", message: "Something went wrong.", correlationId: req.correlationId, fieldErrors: [] },
  });
});

const server = app.listen(port, () => {
  console.log(JSON.stringify({ level: "info", message: "HealthWise listening", port }));
});

export { app, server };
