# Implementation status

Live local application: HealthWise on the Clinexa dashboard shell, container `physio-healthwise`.

| Area | In this build |
|---|---|
| Phase 0 shell, health, sessions, branch-aware roles | Running, with local demo MFA and patient OTP |
| Patients, shared phone picker, masked phone, minor/guardian | Running on synthetic records |
| Calendar, queue, live physio status, visit start/complete | Running |
| Billing in paise, GST, dues, credit notes, packages | Running |
| Reports, audit, notification retry, feature flags | Running for admin roles |
| Patient self-booking and one rating per visit | Running behind server flags |
| Offline | Stale day board only; money and booking stay blocked |
| PostgreSQL, MinIO, production TOTP, Playwright, real PHI | Not in this container |
