import assert from "node:assert/strict";
import test from "node:test";
import { createStore } from "../server/store.js";
import { snapshotToTables, tablesToSnapshot } from "../server/mysql.js";

test("the clinic snapshot round-trips through the MySQL table shape", () => {
  const store = createStore();
  const restored = tablesToSnapshot(snapshotToTables(store.data));
  const stable = tablesToSnapshot(snapshotToTables(restored));
  assert.equal(JSON.stringify(stable), JSON.stringify(restored));
  assert.equal(restored.organization.name, "HealthWise Physiotherapy");
  assert.equal(restored.patients.find((patient) => patient.id === "pt-ananya").phone, "9845012345");
  assert.equal(restored.appointments.find((row) => row.id === "apt-ananya").physioId, "ph-neha");
  assert.equal(restored.services.find((service) => service.id === "svc-manual").durationMin, 40);
  assert.equal(restored.services.find((service) => service.id === "svc-consult").maxSlots, 1);
  assert.ok(restored.services.find((service) => service.id === "svc-manual").maxSlots > 1);
  assert.equal(restored.invoices[0].number, store.data.invoices[0].number);
  assert.equal(restored.invoices[0].lines[0].unitPaise, store.data.invoices[0].lines[0].unitPaise);
  assert.equal(restored.users.find((user) => user.email === "priya.shah@healthwise.local").password.hash, store.data.users.find((user) => user.email === "priya.shah@healthwise.local").password.hash);
  assert.equal(restored.purchases[0].creditsLeft, 5);
  assert.equal(restored.prices["br-kor:svc-consult"], 80000);
  assert.deepEqual(restored.physios.find((physio) => physio.id === "ph-neha").consult.days, store.data.physios.find((physio) => physio.id === "ph-neha").consult.days);
});
