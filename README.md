# HealthWise

Multi-branch physiotherapy clinic desk. The interface uses the Clinexa dashboard shell and HealthWise clinic workflows. The running container is `physio-healthwise`.

This build is a local operational application with synthetic patients. It is not cleared for real clinical records. Sign-in uses a local demo code rather than a production authenticator app.

## Open the app

After the container is running:

http://localhost:8080

## Demo sign-in

Password for every clinic account: `HealthWise#2026`  
Local staff verification code: `246810`

| Person | Email | Role |
|---|---|---|
| Leela D'Souza | leela.reception@healthwise.local | Reception, Koramangala |
| Dr. Neha Kulkarni | neha.kulkarni@healthwise.local | Physiotherapist |
| Arun Nair | arun.nair@healthwise.local | Branch admin, Koramangala only |
| Priya Shah | priya.shah@healthwise.local | Organization admin |

Patient portal: mobile `9845012345`, local code `482910`. That number is shared by Ananya Rao (`HW-10021`) and Rohan Rao (`HW-10088`). Pick the profile; the records are not merged.

## Docker

MySQL 8 starts with the app. The first start loads `db/init/01-healthwise.sql`, which is a snapshot of the clinic database (patients, bookings, invoices, and the rest).

```bash
docker compose up -d --build
docker ps --filter name=physio-healthwise
```

The app is at http://localhost:8080. MySQL is on `127.0.0.1:3307`, database `healthwise`, user `healthwise`, password `healthwise_local`.

Stop the app:

```bash
docker compose down
```

Reset synthetic data and load the SQL snapshot again:

```bash
docker compose down -v
docker compose up -d --build
```

## Checks

```bash
npm test
```

Business times display in Asia/Kolkata. Money is stored as integer paise.
