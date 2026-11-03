-- HealthWise clinic database. Money is integer paise. Times are UTC ISO strings.

CREATE TABLE IF NOT EXISTS organization (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  gst_mode VARCHAR(20) NOT NULL,
  gst_bps INT NOT NULL,
  discount_cap_bps INT NOT NULL,
  patient_booking TINYINT(1) NOT NULL DEFAULT 1,
  public_ratings TINYINT(1) NOT NULL DEFAULT 1,
  parallel_therapy_capacity INT NOT NULL DEFAULT 1,
  schema_version INT NOT NULL DEFAULT 2,
  calendar_demo TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS branches (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(160) NOT NULL,
  city VARCHAR(80) NOT NULL DEFAULT '',
  hours VARCHAR(40) NOT NULL DEFAULT '',
  parallel_therapy_capacity INT NULL,
  UNIQUE KEY uq_branches_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS services (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  category_id VARCHAR(64) NULL,
  duration_min INT NOT NULL,
  min_duration_min INT NOT NULL,
  duration_step_min INT NOT NULL,
  max_duration_min INT NOT NULL,
  max_slots INT NOT NULL DEFAULT 1,
  KEY ix_services_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_prices (
  branch_id VARCHAR(64) NOT NULL,
  service_id VARCHAR(64) NOT NULL,
  price_paise INT NOT NULL,
  PRIMARY KEY (branch_id, service_id),
  KEY ix_service_prices_service (service_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_methods (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(80) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_payment_methods_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS physios (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  engagement VARCHAR(20) NOT NULL,
  specialty VARCHAR(80) NOT NULL DEFAULT '',
  branch_id VARCHAR(64) NOT NULL,
  availability VARCHAR(20) NOT NULL,
  rating_sum INT NOT NULL DEFAULT 0,
  review_count INT NOT NULL DEFAULT 0,
  gender VARCHAR(20) NOT NULL DEFAULT '',
  phone VARCHAR(20) NOT NULL DEFAULT '',
  email VARCHAR(190) NOT NULL DEFAULT '',
  experience_years INT NULL,
  consult_days JSON NOT NULL,
  consult_start CHAR(5) NOT NULL,
  consult_end CHAR(5) NOT NULL,
  parallel_therapy_capacity INT NULL,
  KEY ix_physios_branch (branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS physio_leave (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  physio_id VARCHAR(64) NOT NULL,
  from_date CHAR(10) NOT NULL,
  to_date CHAR(10) NOT NULL,
  note VARCHAR(160) NOT NULL DEFAULT '',
  pos INT NOT NULL,
  KEY ix_physio_leave_physio (physio_id, from_date, to_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(20) NOT NULL DEFAULT '',
  role VARCHAR(20) NOT NULL,
  password_salt VARCHAR(64) NOT NULL,
  password_hash VARCHAR(128) NOT NULL,
  terms_accepted TINYINT(1) NOT NULL DEFAULT 0,
  physio_id VARCHAR(64) NULL,
  patient_id VARCHAR(64) NULL,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_branches (
  user_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  pos INT NOT NULL,
  PRIMARY KEY (user_id, branch_id),
  KEY ix_user_branches_branch (branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS patients (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(160) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  gender VARCHAR(20) NOT NULL,
  dob CHAR(10) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  is_minor TINYINT(1) NOT NULL DEFAULT 0,
  flags JSON NOT NULL,
  guardian JSON NULL,
  merged_into VARCHAR(64) NULL,
  email VARCHAR(190) NOT NULL DEFAULT '',
  address VARCHAR(240) NOT NULL DEFAULT '',
  occupation VARCHAR(80) NOT NULL DEFAULT '',
  blood_group VARCHAR(8) NOT NULL DEFAULT '',
  referring_doctor VARCHAR(160) NOT NULL DEFAULT '',
  condition_text VARCHAR(240) NOT NULL DEFAULT '',
  affected_area VARCHAR(120) NOT NULL DEFAULT '',
  pain_score INT NULL,
  onset VARCHAR(80) NOT NULL DEFAULT '',
  precautions VARCHAR(240) NOT NULL DEFAULT '',
  emergency_name VARCHAR(160) NOT NULL DEFAULT '',
  emergency_phone VARCHAR(20) NOT NULL DEFAULT '',
  UNIQUE KEY uq_patients_code (code),
  KEY ix_patients_phone (phone),
  KEY ix_patients_branch (branch_id),
  KEY ix_patients_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appointments (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL,
  patient_id VARCHAR(64) NOT NULL,
  physio_id VARCHAR(64) NOT NULL,
  service_id VARCHAR(64) NOT NULL,
  start_at VARCHAR(40) NOT NULL,
  end_at VARCHAR(40) NOT NULL,
  duration_min INT NOT NULL,
  slot_count INT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL,
  queue_status VARCHAR(20) NULL,
  reason_code VARCHAR(40) NULL,
  invoice_id VARCHAR(64) NULL,
  package_consumed TINYINT(1) NOT NULL DEFAULT 0,
  note VARCHAR(2000) NOT NULL DEFAULT '',
  walk_in TINYINT(1) NOT NULL DEFAULT 0,
  KEY ix_appointments_physio_time (physio_id, start_at, end_at, status),
  KEY ix_appointments_branch_time (branch_id, start_at),
  KEY ix_appointments_patient (patient_id),
  KEY ix_appointments_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS visits (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  appointment_id VARCHAR(64) NOT NULL,
  patient_id VARCHAR(64) NOT NULL,
  physio_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL,
  note VARCHAR(2000) NOT NULL DEFAULT '',
  started_at VARCHAR(40) NULL,
  completed_at VARCHAR(40) NULL,
  KEY ix_visits_appointment (appointment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  number VARCHAR(40) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  patient_id VARCHAR(64) NOT NULL,
  appointment_id VARCHAR(64) NULL,
  transaction_id VARCHAR(80) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL,
  gst_mode VARCHAR(20) NOT NULL,
  discount_bps INT NOT NULL DEFAULT 0,
  subtotal_paise INT NOT NULL,
  discount_paise INT NOT NULL,
  tax_paise INT NOT NULL,
  total_paise INT NOT NULL,
  paid_paise INT NOT NULL DEFAULT 0,
  posted_at VARCHAR(40) NOT NULL,
  UNIQUE KEY uq_invoices_number (number),
  KEY ix_invoices_patient (patient_id),
  KEY ix_invoices_branch (branch_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_lines (
  invoice_id VARCHAR(64) NOT NULL,
  line_no INT NOT NULL,
  service_id VARCHAR(64) NOT NULL,
  name VARCHAR(160) NOT NULL,
  qty INT NOT NULL,
  unit_paise INT NOT NULL,
  tax_bps INT NOT NULL,
  appointment_id VARCHAR(64) NULL,
  PRIMARY KEY (invoice_id, line_no),
  KEY ix_invoice_lines_appointment (appointment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_appointments (
  invoice_id VARCHAR(64) NOT NULL,
  appointment_id VARCHAR(64) NOT NULL,
  pos INT NOT NULL,
  PRIMARY KEY (invoice_id, appointment_id),
  KEY ix_invoice_appointments_appointment (appointment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  invoice_id VARCHAR(64) NOT NULL,
  method VARCHAR(40) NOT NULL,
  amount_paise INT NOT NULL,
  paid_at VARCHAR(40) NOT NULL,
  KEY ix_payments_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS credit_notes (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  invoice_id VARCHAR(64) NOT NULL,
  reason VARCHAR(400) NOT NULL,
  amount_paise INT NOT NULL,
  issued_at VARCHAR(40) NOT NULL,
  KEY ix_credit_notes_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS packages (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  credits INT NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  category_id VARCHAR(64) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS package_prices (
  package_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  price_paise INT NOT NULL,
  PRIMARY KEY (package_id, branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchases (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  patient_id VARCHAR(64) NOT NULL,
  package_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  credits_total INT NOT NULL,
  credits_left INT NOT NULL,
  frozen TINYINT(1) NOT NULL DEFAULT 0,
  expires_on CHAR(10) NULL,
  status VARCHAR(20) NOT NULL,
  KEY ix_purchases_patient (patient_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL,
  patient_id VARCHAR(64) NOT NULL,
  channel VARCHAR(20) NOT NULL,
  template VARCHAR(40) NOT NULL,
  status VARCHAR(20) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  last_error VARCHAR(240) NOT NULL DEFAULT '',
  sent_at VARCHAR(40) NOT NULL,
  pos INT NOT NULL,
  KEY ix_notifications_branch (branch_id, pos)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_events (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  event_at VARCHAR(40) NOT NULL,
  actor_id VARCHAR(80) NULL,
  actor_name VARCHAR(160) NOT NULL,
  action VARCHAR(60) NOT NULL,
  branch_id VARCHAR(64) NULL,
  target_type VARCHAR(40) NOT NULL,
  target_id VARCHAR(80) NOT NULL,
  outcome VARCHAR(20) NOT NULL,
  correlation_id VARCHAR(80) NULL,
  pos INT NOT NULL,
  KEY ix_audit_branch (branch_id, pos)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  token VARCHAR(80) NOT NULL,
  user_id VARCHAR(80) NOT NULL,
  role VARCHAR(20) NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  patient_id VARCHAR(64) NULL,
  UNIQUE KEY uq_sessions_token (token),
  KEY ix_sessions_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS idempotency_keys (
  slot_key VARCHAR(160) NOT NULL PRIMARY KEY,
  fingerprint CHAR(64) NOT NULL,
  result_json JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS feedback (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  appointment_id VARCHAR(64) NOT NULL,
  patient_id VARCHAR(64) NOT NULL,
  physio_id VARCHAR(64) NOT NULL,
  rating INT NOT NULL,
  comment VARCHAR(400) NOT NULL DEFAULT '',
  given_at VARCHAR(40) NOT NULL,
  UNIQUE KEY uq_feedback_appointment (appointment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_sequences (
  branch_id VARCHAR(64) NOT NULL PRIMARY KEY,
  seq INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
