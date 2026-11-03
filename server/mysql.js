import fs from "node:fs";
import mysql from "mysql2/promise";
import { createStore } from "./store.js";

const TABLE_ORDER = [
  "invoice_lines",
  "invoice_appointments",
  "payments",
  "credit_notes",
  "visits",
  "feedback",
  "notifications",
  "audit_events",
  "sessions",
  "idempotency_keys",
  "purchases",
  "package_prices",
  "service_prices",
  "physio_leave",
  "user_branches",
  "invoice_sequences",
  "appointments",
  "invoices",
  "packages",
  "services",
  "categories",
  "payment_methods",
  "patients",
  "physios",
  "users",
  "branches",
  "organization",
];

const bit = (value) => (value ? 1 : 0);
const on = (value) => value === true || value === 1;
const text = (value) => (value == null ? "" : String(value));
const nullable = (value) => (value == null || value === "" ? null : value);

function asJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

export function snapshotToTables(data) {
  const organization = data.organization || { id: "org-hw", name: "HealthWise Physiotherapy", gstMode: "REGULAR", gstBps: 1800, discountCapBps: 1000 };
  const tables = {
    organization: [{
      id: organization.id,
      name: organization.name,
      gst_mode: organization.gstMode || "REGULAR",
      gst_bps: organization.gstBps ?? 1800,
      discount_cap_bps: organization.discountCapBps ?? 1000,
      patient_booking: bit(data.flags?.patientBooking !== false),
      public_ratings: bit(data.flags?.publicRatings !== false),
      parallel_therapy_capacity: data.bookingConfig?.parallelTherapyCapacity || 1,
      schema_version: data.schemaVersion || 2,
      calendar_demo: bit(data.calendarDemo),
    }],
    branches: (data.branches || []).map((branch) => ({
      id: branch.id,
      code: branch.code,
      name: branch.name,
      city: text(branch.city),
      hours: text(branch.hours),
      parallel_therapy_capacity: Number.isInteger(branch.parallelTherapyCapacity) ? branch.parallelTherapyCapacity : null,
    })),
    categories: (data.categories || []).map((category) => ({
      id: category.id,
      name: category.name,
      kind: category.kind,
      active: bit(category.active !== false),
    })),
    services: (data.services || []).map((service) => ({
      id: service.id,
      name: service.name,
      kind: service.kind || "THERAPY",
      active: bit(service.active !== false),
      category_id: nullable(service.categoryId),
      duration_min: service.durationMin || service.minDurationMin || 30,
      min_duration_min: service.minDurationMin || service.durationMin || 30,
      duration_step_min: service.durationStepMin || service.durationMin || 30,
      max_duration_min: service.maxDurationMin || service.durationMin || 30,
      max_slots: service.maxSlots || 1,
    })),
    service_prices: Object.entries(data.prices || {}).map(([key, pricePaise]) => {
      const split = key.indexOf(":");
      return { branch_id: key.slice(0, split), service_id: key.slice(split + 1), price_paise: pricePaise };
    }),
    payment_methods: (data.paymentMethods || []).map((method) => ({
      id: method.id,
      code: method.code,
      name: method.name,
      active: bit(method.active !== false),
    })),
    physios: (data.physios || []).map((physio) => ({
      id: physio.id,
      name: physio.name,
      engagement: physio.engagement || "EMPLOYEE",
      specialty: text(physio.specialty),
      branch_id: physio.branchId,
      availability: physio.availability || "AVAILABLE",
      rating_sum: physio.ratingSum || 0,
      review_count: physio.reviewCount || 0,
      gender: text(physio.gender),
      phone: text(physio.phone),
      email: text(physio.email),
      experience_years: Number.isInteger(physio.experienceYears) ? physio.experienceYears : null,
      consult_days: JSON.stringify(physio.consult?.days || [1, 2, 3, 4, 5, 6]),
      consult_start: physio.consult?.start || "09:00",
      consult_end: physio.consult?.end || "18:00",
      parallel_therapy_capacity: Number.isInteger(physio.parallelTherapyCapacity) ? physio.parallelTherapyCapacity : null,
    })),
    physio_leave: (data.physios || []).flatMap((physio) => (physio.leave || []).map((item, pos) => ({
      id: item.id || `${physio.id}:${item.from}:${item.to}:${pos}`,
      physio_id: physio.id,
      from_date: item.from,
      to_date: item.to,
      note: text(item.note),
      pos,
    }))),
    users: (data.users || []).map((user) => ({
      id: user.id,
      name: user.name,
      email: nullable(user.email),
      phone: text(user.phone),
      role: user.role,
      password_salt: user.password?.salt || "",
      password_hash: user.password?.hash || "",
      terms_accepted: bit(user.termsAccepted),
      physio_id: nullable(user.physioId),
      patient_id: nullable(user.patientId),
    })),
    user_branches: (data.users || []).flatMap((user) => (user.branchIds || []).map((branchId, pos) => ({
      user_id: user.id,
      branch_id: branchId,
      pos,
    }))),
    patients: (data.patients || []).map((patient) => ({
      id: patient.id,
      code: patient.code,
      name: patient.name,
      phone: patient.phone,
      gender: patient.gender,
      dob: patient.dob,
      branch_id: patient.branchId,
      is_minor: bit(patient.isMinor),
      flags: JSON.stringify(patient.flags || []),
      guardian: patient.guardian ? JSON.stringify(patient.guardian) : null,
      merged_into: nullable(patient.mergedInto),
      email: text(patient.email),
      address: text(patient.address),
      occupation: text(patient.occupation),
      blood_group: text(patient.bloodGroup),
      referring_doctor: text(patient.referringDoctor),
      condition_text: text(patient.condition),
      affected_area: text(patient.affectedArea),
      pain_score: Number.isInteger(patient.painScore) ? patient.painScore : null,
      onset: text(patient.onset),
      precautions: text(patient.precautions),
      emergency_name: text(patient.emergencyName),
      emergency_phone: text(patient.emergencyPhone),
    })),
    appointments: (data.appointments || []).map((row) => ({
      id: row.id,
      branch_id: row.branchId,
      patient_id: row.patientId,
      physio_id: row.physioId,
      service_id: row.serviceId,
      start_at: row.start,
      end_at: row.end,
      duration_min: row.durationMin || 30,
      slot_count: row.slotCount || 1,
      status: row.status,
      queue_status: nullable(row.queueStatus),
      reason_code: nullable(row.reasonCode),
      invoice_id: nullable(row.invoiceId),
      package_consumed: bit(row.packageConsumed),
      note: text(row.note),
      walk_in: bit(row.walkIn),
    })),
    visits: (data.visits || []).map((row) => ({
      id: row.id,
      appointment_id: row.appointmentId,
      patient_id: row.patientId,
      physio_id: row.physioId,
      branch_id: row.branchId,
      status: row.status,
      note: text(row.note),
      started_at: nullable(row.startedAt),
      completed_at: nullable(row.completedAt),
    })),
    invoices: (data.invoices || []).map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      branch_id: invoice.branchId,
      patient_id: invoice.patientId,
      appointment_id: nullable(invoice.appointmentId),
      transaction_id: text(invoice.transactionId),
      status: invoice.status,
      gst_mode: invoice.gstMode || "REGULAR",
      discount_bps: invoice.discountBps || 0,
      subtotal_paise: invoice.subtotalPaise || 0,
      discount_paise: invoice.discountPaise || 0,
      tax_paise: invoice.taxPaise || 0,
      total_paise: invoice.totalPaise || 0,
      paid_paise: invoice.paidPaise || 0,
      posted_at: invoice.postedAt,
    })),
    invoice_lines: (data.invoices || []).flatMap((invoice) => (invoice.lines || []).map((line, lineNo) => ({
      invoice_id: invoice.id,
      line_no: lineNo,
      service_id: line.serviceId,
      name: line.name,
      qty: line.qty,
      unit_paise: line.unitPaise,
      tax_bps: line.taxBps || 0,
      appointment_id: nullable(line.appointmentId),
    }))),
    invoice_appointments: (data.invoices || []).flatMap((invoice) => {
      const ids = invoice.appointmentIds?.length ? invoice.appointmentIds : (invoice.appointmentId ? [invoice.appointmentId] : []);
      return ids.map((appointmentId, pos) => ({ invoice_id: invoice.id, appointment_id: appointmentId, pos }));
    }),
    payments: (data.payments || []).map((row) => ({
      id: row.id,
      invoice_id: row.invoiceId,
      method: row.method,
      amount_paise: row.amountPaise,
      paid_at: row.at,
    })),
    credit_notes: (data.creditNotes || []).map((row) => ({
      id: row.id,
      invoice_id: row.invoiceId,
      reason: row.reason,
      amount_paise: row.amountPaise,
      issued_at: row.at,
    })),
    packages: (data.packages || []).map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      credits: pkg.credits,
      active: bit(pkg.active !== false),
      category_id: nullable(pkg.categoryId),
    })),
    package_prices: (data.packages || []).flatMap((pkg) => Object.entries(pkg.prices || {}).map(([branchId, pricePaise]) => ({
      package_id: pkg.id,
      branch_id: branchId,
      price_paise: pricePaise,
    }))),
    purchases: (data.purchases || []).map((row) => ({
      id: row.id,
      patient_id: row.patientId,
      package_id: row.packageId,
      branch_id: row.branchId,
      credits_total: row.creditsTotal,
      credits_left: row.creditsLeft,
      frozen: bit(row.frozen),
      expires_on: nullable(row.expiresOn),
      status: row.status,
    })),
    notifications: (data.notifications || []).map((row, pos) => ({
      id: row.id,
      branch_id: row.branchId,
      patient_id: row.patientId,
      channel: row.channel,
      template: row.template,
      status: row.status,
      attempts: row.attempts || 0,
      last_error: text(row.lastError),
      sent_at: row.at,
      pos,
    })),
    audit_events: (data.audit || []).map((row, pos) => ({
      id: row.id,
      event_at: row.at,
      actor_id: nullable(row.actorId),
      actor_name: text(row.actorName),
      action: row.action,
      branch_id: nullable(row.branchId),
      target_type: row.targetType,
      target_id: text(row.targetId),
      outcome: row.outcome,
      correlation_id: nullable(row.correlationId),
      pos,
    })),
    sessions: (data.sessions || []).map((row) => ({
      id: row.id,
      token: row.token,
      user_id: row.userId,
      role: row.role,
      created_at: row.createdAt,
      patient_id: nullable(row.patientId),
    })),
    idempotency_keys: Object.entries(data.idempotency || {}).map(([slotKey, entry]) => ({
      slot_key: slotKey,
      fingerprint: entry.fingerprint,
      result_json: JSON.stringify(entry.result ?? null),
    })),
    feedback: (data.feedback || []).map((row) => ({
      id: row.id,
      appointment_id: row.appointmentId,
      patient_id: row.patientId,
      physio_id: row.physioId,
      rating: row.rating,
      comment: text(row.comment),
      given_at: row.at,
    })),
    invoice_sequences: Object.entries(data.invoiceSeq || {}).map(([branchId, seq]) => ({
      branch_id: branchId,
      seq,
    })),
  };
  return tables;
}

function byPos(rows) {
  return [...rows].sort((a, b) => a.pos - b.pos);
}

export function tablesToSnapshot(tables) {
  const org = tables.organization?.[0];
  if (!org) return null;
  const leaveByPhysio = new Map();
  for (const item of byPos(tables.physio_leave || [])) {
    const list = leaveByPhysio.get(item.physio_id) || [];
    const leave = { from: item.from_date, to: item.to_date };
    if (item.note) leave.note = item.note;
    list.push(leave);
    leaveByPhysio.set(item.physio_id, list);
  }
  const branchesByUser = new Map();
  for (const row of byPos(tables.user_branches || [])) {
    const list = branchesByUser.get(row.user_id) || [];
    list.push(row.branch_id);
    branchesByUser.set(row.user_id, list);
  }
  const linesByInvoice = new Map();
  for (const line of tables.invoice_lines || []) {
    const list = linesByInvoice.get(line.invoice_id) || [];
    list.push(line);
    linesByInvoice.set(line.invoice_id, list);
  }
  const linksByInvoice = new Map();
  for (const link of byPos(tables.invoice_appointments || [])) {
    const list = linksByInvoice.get(link.invoice_id) || [];
    list.push(link.appointment_id);
    linksByInvoice.set(link.invoice_id, list);
  }
  const packagePrices = new Map();
  for (const price of tables.package_prices || []) {
    const prices = packagePrices.get(price.package_id) || {};
    prices[price.branch_id] = price.price_paise;
    packagePrices.set(price.package_id, prices);
  }
  const prices = {};
  for (const price of tables.service_prices || []) prices[`${price.branch_id}:${price.service_id}`] = price.price_paise;
  const idempotency = {};
  for (const entry of tables.idempotency_keys || []) {
    idempotency[entry.slot_key] = { fingerprint: entry.fingerprint, result: asJson(entry.result_json, null) };
  }
  const invoiceSeq = {};
  for (const row of tables.invoice_sequences || []) invoiceSeq[row.branch_id] = row.seq;

  return {
    organization: {
      id: org.id,
      name: org.name,
      gstMode: org.gst_mode,
      gstBps: org.gst_bps,
      discountCapBps: org.discount_cap_bps,
    },
    flags: { patientBooking: on(org.patient_booking), publicRatings: on(org.public_ratings) },
    bookingConfig: { parallelTherapyCapacity: org.parallel_therapy_capacity },
    schemaVersion: org.schema_version,
    calendarDemo: on(org.calendar_demo),
    branches: (tables.branches || []).map((branch) => {
      const row = { id: branch.id, code: branch.code, name: branch.name, city: branch.city, hours: branch.hours };
      if (branch.parallel_therapy_capacity != null) row.parallelTherapyCapacity = branch.parallel_therapy_capacity;
      return row;
    }),
    categories: (tables.categories || []).map((category) => ({
      id: category.id,
      name: category.name,
      kind: category.kind,
      active: on(category.active),
    })),
    services: (tables.services || []).map((service) => ({
      id: service.id,
      name: service.name,
      kind: service.kind,
      active: on(service.active),
      categoryId: service.category_id,
      durationMin: service.duration_min,
      minDurationMin: service.min_duration_min,
      durationStepMin: service.duration_step_min,
      maxDurationMin: service.max_duration_min,
      maxSlots: service.max_slots,
    })),
    prices,
    paymentMethods: (tables.payment_methods || []).map((method) => ({
      id: method.id,
      code: method.code,
      name: method.name,
      active: on(method.active),
    })),
    physios: (tables.physios || []).map((physio) => {
      const row = {
        id: physio.id,
        name: physio.name,
        engagement: physio.engagement,
        specialty: physio.specialty,
        branchId: physio.branch_id,
        availability: physio.availability,
        ratingSum: physio.rating_sum,
        reviewCount: physio.review_count,
        gender: physio.gender,
        phone: physio.phone,
        email: physio.email,
        experienceYears: physio.experience_years,
        consult: {
          days: asJson(physio.consult_days, [1, 2, 3, 4, 5, 6]),
          start: physio.consult_start,
          end: physio.consult_end,
        },
        leave: leaveByPhysio.get(physio.id) || [],
      };
      if (physio.parallel_therapy_capacity != null) row.parallelTherapyCapacity = physio.parallel_therapy_capacity;
      return row;
    }),
    users: (tables.users || []).map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email || undefined,
      phone: user.phone || undefined,
      role: user.role,
      branchIds: branchesByUser.get(user.id) || [],
      physioId: user.physio_id || undefined,
      patientId: user.patient_id || undefined,
      password: { salt: user.password_salt, hash: user.password_hash },
      termsAccepted: on(user.terms_accepted),
    })),
    patients: (tables.patients || []).map((patient) => ({
      id: patient.id,
      code: patient.code,
      name: patient.name,
      phone: patient.phone,
      gender: patient.gender,
      dob: patient.dob,
      branchId: patient.branch_id,
      isMinor: on(patient.is_minor),
      flags: asJson(patient.flags, []),
      guardian: asJson(patient.guardian, null),
      mergedInto: patient.merged_into,
      email: patient.email,
      address: patient.address,
      occupation: patient.occupation,
      bloodGroup: patient.blood_group,
      referringDoctor: patient.referring_doctor,
      condition: patient.condition_text,
      affectedArea: patient.affected_area,
      painScore: patient.pain_score,
      onset: patient.onset,
      precautions: patient.precautions,
      emergencyName: patient.emergency_name,
      emergencyPhone: patient.emergency_phone,
    })),
    appointments: (tables.appointments || []).map((row) => {
      const appointment = {
        id: row.id,
        branchId: row.branch_id,
        patientId: row.patient_id,
        physioId: row.physio_id,
        serviceId: row.service_id,
        start: row.start_at,
        end: row.end_at,
        durationMin: row.duration_min,
        slotCount: row.slot_count,
        status: row.status,
        queueStatus: row.queue_status,
        reasonCode: row.reason_code,
        invoiceId: row.invoice_id,
        packageConsumed: on(row.package_consumed),
        note: row.note,
      };
      if (on(row.walk_in)) appointment.walkIn = true;
      return appointment;
    }),
    visits: (tables.visits || []).map((row) => ({
      id: row.id,
      appointmentId: row.appointment_id,
      patientId: row.patient_id,
      physioId: row.physio_id,
      branchId: row.branch_id,
      status: row.status,
      note: row.note,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    })),
    invoices: (tables.invoices || []).map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      branchId: invoice.branch_id,
      patientId: invoice.patient_id,
      appointmentId: invoice.appointment_id,
      appointmentIds: linksByInvoice.get(invoice.id) || (invoice.appointment_id ? [invoice.appointment_id] : []),
      transactionId: invoice.transaction_id,
      status: invoice.status,
      gstMode: invoice.gst_mode,
      lines: (linesByInvoice.get(invoice.id) || [])
        .sort((a, b) => a.line_no - b.line_no)
        .map((line) => ({
          serviceId: line.service_id,
          name: line.name,
          qty: line.qty,
          unitPaise: line.unit_paise,
          taxBps: line.tax_bps,
          appointmentId: line.appointment_id,
        })),
      discountBps: invoice.discount_bps,
      subtotalPaise: invoice.subtotal_paise,
      discountPaise: invoice.discount_paise,
      taxPaise: invoice.tax_paise,
      totalPaise: invoice.total_paise,
      paidPaise: invoice.paid_paise,
      postedAt: invoice.posted_at,
    })),
    payments: (tables.payments || []).map((row) => ({
      id: row.id,
      invoiceId: row.invoice_id,
      method: row.method,
      amountPaise: row.amount_paise,
      at: row.paid_at,
    })),
    creditNotes: (tables.credit_notes || []).map((row) => ({
      id: row.id,
      invoiceId: row.invoice_id,
      reason: row.reason,
      amountPaise: row.amount_paise,
      at: row.issued_at,
    })),
    packages: (tables.packages || []).map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      credits: pkg.credits,
      active: on(pkg.active),
      categoryId: pkg.category_id,
      prices: packagePrices.get(pkg.id) || {},
    })),
    purchases: (tables.purchases || []).map((row) => ({
      id: row.id,
      patientId: row.patient_id,
      packageId: row.package_id,
      branchId: row.branch_id,
      creditsTotal: row.credits_total,
      creditsLeft: row.credits_left,
      frozen: on(row.frozen),
      expiresOn: row.expires_on,
      status: row.status,
    })),
    notifications: byPos(tables.notifications || []).map((row) => ({
      id: row.id,
      branchId: row.branch_id,
      patientId: row.patient_id,
      channel: row.channel,
      template: row.template,
      status: row.status,
      attempts: row.attempts,
      lastError: row.last_error,
      at: row.sent_at,
    })),
    audit: byPos(tables.audit_events || []).map((row) => ({
      id: row.id,
      at: row.event_at,
      actorId: row.actor_id,
      actorName: row.actor_name,
      action: row.action,
      branchId: row.branch_id,
      targetType: row.target_type,
      targetId: row.target_id,
      outcome: row.outcome,
      correlationId: row.correlation_id,
    })),
    sessions: (tables.sessions || []).map((row) => ({
      id: row.id,
      token: row.token,
      userId: row.user_id,
      role: row.role,
      createdAt: row.created_at,
      patientId: row.patient_id,
    })),
    idempotency,
    feedback: (tables.feedback || []).map((row) => ({
      id: row.id,
      appointmentId: row.appointment_id,
      patientId: row.patient_id,
      physioId: row.physio_id,
      rating: row.rating,
      comment: row.comment,
      at: row.given_at,
    })),
    invoiceSeq,
  };
}

function schemaStatements() {
  const sql = fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8").replace(/--.*$/gm, "");
  return sql.split(";").map((statement) => statement.trim()).filter(Boolean);
}

async function ensureSchema(pool) {
  for (const statement of schemaStatements()) await pool.query(statement);
  const foreignKeys = [
    ["fk_physios_branch", "physios", "branch_id", "branches", "id"],
    ["fk_leave_physio", "physio_leave", "physio_id", "physios", "id"],
    ["fk_user_branches_user", "user_branches", "user_id", "users", "id"],
    ["fk_user_branches_branch", "user_branches", "branch_id", "branches", "id"],
    ["fk_patients_branch", "patients", "branch_id", "branches", "id"],
    ["fk_appointments_branch", "appointments", "branch_id", "branches", "id"],
    ["fk_appointments_patient", "appointments", "patient_id", "patients", "id"],
    ["fk_appointments_physio", "appointments", "physio_id", "physios", "id"],
    ["fk_appointments_service", "appointments", "service_id", "services", "id"],
    ["fk_visits_appointment", "visits", "appointment_id", "appointments", "id"],
    ["fk_invoices_branch", "invoices", "branch_id", "branches", "id"],
    ["fk_invoices_patient", "invoices", "patient_id", "patients", "id"],
    ["fk_invoice_lines_invoice", "invoice_lines", "invoice_id", "invoices", "id"],
    ["fk_invoice_appointments_invoice", "invoice_appointments", "invoice_id", "invoices", "id"],
    ["fk_invoice_appointments_appointment", "invoice_appointments", "appointment_id", "appointments", "id"],
    ["fk_payments_invoice", "payments", "invoice_id", "invoices", "id"],
    ["fk_credit_notes_invoice", "credit_notes", "invoice_id", "invoices", "id"],
    ["fk_service_prices_branch", "service_prices", "branch_id", "branches", "id"],
    ["fk_service_prices_service", "service_prices", "service_id", "services", "id"],
    ["fk_package_prices_package", "package_prices", "package_id", "packages", "id"],
    ["fk_package_prices_branch", "package_prices", "branch_id", "branches", "id"],
    ["fk_purchases_patient", "purchases", "patient_id", "patients", "id"],
    ["fk_purchases_package", "purchases", "package_id", "packages", "id"],
    ["fk_purchases_branch", "purchases", "branch_id", "branches", "id"],
    ["fk_notifications_patient", "notifications", "patient_id", "patients", "id"],
    ["fk_feedback_appointment", "feedback", "appointment_id", "appointments", "id"],
    ["fk_sequences_branch", "invoice_sequences", "branch_id", "branches", "id"],
  ];
  for (const [name, table, column, refTable, refColumn] of foreignKeys) {
    try {
      await pool.query(`ALTER TABLE \`${table}\` ADD CONSTRAINT \`${name}\` FOREIGN KEY (\`${column}\`) REFERENCES \`${refTable}\` (\`${refColumn}\`)`);
    } catch (error) {
      if (error.code !== "ER_DUP_KEY" && error.code !== "ER_FK_DUP_NAME" && error.errno !== 1826 && error.errno !== 121) throw error;
    }
  }
}

async function insertRows(conn, table, rows) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);
  const chunk = 80;
  for (let index = 0; index < rows.length; index += chunk) {
    const slice = rows.slice(index, index + chunk);
    const marks = slice.map(() => `(${columns.map(() => "?").join(",")})`).join(",");
    const values = slice.flatMap((row) => columns.map((column) => row[column] ?? null));
    await conn.query(`INSERT INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(",")}) VALUES ${marks}`, values);
  }
}

export async function replaceAll(pool, data) {
  const tables = snapshotToTables(data);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("SET FOREIGN_KEY_CHECKS=0");
    for (const table of TABLE_ORDER) await conn.query(`DELETE FROM \`${table}\``);
    for (const table of [...TABLE_ORDER].reverse()) await insertRows(conn, table, tables[table] || []);
    await conn.query("SET FOREIGN_KEY_CHECKS=1");
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function loadAll(pool) {
  const tables = {};
  for (const table of TABLE_ORDER) {
    const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
    tables[table] = rows;
  }
  return tablesToSnapshot(tables);
}

function createPool(url) {
  return mysql.createPool({
    uri: url,
    waitForConnections: true,
    connectionLimit: 8,
    timezone: "Z",
    dateStrings: true,
  });
}

export async function openMysqlStore(options) {
  const pool = createPool(options.url);
  await ensureSchema(pool);
  const [countRows] = await pool.query("SELECT COUNT(*) AS n FROM organization");
  const empty = Number(countRows[0].n) === 0;
  let initial = null;
  if (!empty) initial = await loadAll(pool);
  else if (options.file && fs.existsSync(options.file)) initial = JSON.parse(fs.readFileSync(options.file, "utf8"));
  let chain = Promise.resolve();
  const enqueue = (snapshot) => {
    const copy = structuredClone(snapshot);
    chain = chain.then(() => replaceAll(pool, copy)).catch((error) => {
      console.error(JSON.stringify({ level: "error", message: "MySQL save failed", detail: error.message }));
    });
    return chain;
  };
  const store = createStore({ ...options, data: initial || undefined, file: null, onSave: enqueue });
  store.driver = "mysql";
  await chain;
  if (empty) await replaceAll(pool, structuredClone(store.data));
  return store;
}
