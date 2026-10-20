import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";

const prisma = new PrismaClient();
const host = "http://127.0.0.1:3100";
const department = "ci-financial";
const ay = "A.Y. 2026 - 2027";
const term = "1st Sem";

async function post(cookie, operation, data) {
  const response = await fetch(host + "/api/clear-ci-finance", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-clear-ci-token": process.env.CLEAR_CI_FINANCE_TEST_TOKEN,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ operation, data }),
    signal: AbortSignal.timeout(60000),
  });
  return { status: response.status, body: await response.json() };
}

async function ciSessionCookie() {
  const org = await prisma.organization.findUniqueOrThrow({ where: { subdomain: department } });
  const officer = await prisma.tenantUser.findFirstOrThrow({
    where: { organizationId: org.id, email: "ci-officer@example.invalid" },
  });
  const jwt = await encode({
    secret: process.env.AUTH_SECRET,
    salt: "authjs.session-token",
    maxAge: 3600,
    token: { sub: officer.id, email: officer.email, name: officer.fullName,
      role: officer.role, department, organizationId: org.id,
      allowedTabs: ["tab-payment", "tab-remittances"] },
  });
  return { cookie: "authjs.session-token=" + jwt, org };
}

test("protected CI-only finance route rejects requests without a real signed session", async () => {
  const response = await post(null, "cashier", {});
  assert.equal(response.status, 401);
});

test("tenant database membership and permissions override a forged signed-session role", async () => {
  const { org } = await ciSessionCookie();
  const viewer = await prisma.tenantUser.create({ data: {
    organizationId: org.id, userId: "CI-READONLY-OFFICER",
    fullName: "CI Read-only Officer", username: "ci_readonly_officer",
    email: "ci-viewer@example.invalid", role: "Viewer", status: "Active",
    allowedTabs: JSON.stringify(["tab-overview"]),
  } });
  // A signed JWT might claim an elevated role after an account was changed.
  // Financial permissions must always come from the current tenant DB record.
  const jwt = await encode({
    secret: process.env.AUTH_SECRET, salt: "authjs.session-token", maxAge: 3600,
    token: { sub: viewer.id, email: viewer.email, name: viewer.fullName,
      role: "Admin", department, organizationId: org.id,
      allowedTabs: ["tab-payment", "tab-remittances"] },
  });
  for (const operation of ["cashier", "remittance"]) {
    const response = await post("authjs.session-token=" + jwt, operation, {});
    assert.equal(response.status, 409, JSON.stringify(response.body));
    assert.match(response.body.error, /403 Forbidden|lacks permission/i);
  }
});

test("authenticated cashier concurrent identical requests post once, reject altered replay", async () => {
  const { cookie, org } = await ciSessionCookie();
  const id = randomUUID();
  const data = { requestId: id, date: "2026-10-20", studentId: "CI-FIN-STUDENT-001",
    studentName: "CI Synthetic Student", studentEmail: "", category: "Membership",
    itemDescription: "Membership Fee", paymentType: "Partial Payment",
    standardRate: 150, amountPaid: 40, fundAllocation: "General Fund", ay, term };
  const firstWave = await Promise.all(
    Array.from({ length: 8 }, () => post(cookie, "cashier", data))
  );
  const successful = firstWave.filter(v => v.body.success);
  assert.ok(successful.length > 0, "At least one authenticated cashier request must succeed: " + JSON.stringify(firstWave));
  const firstOr = successful[0].body.result.orNumber;
  assert.match(firstOr, /^OR-\d{8}-\d{6}-\d+$/);
  assert.ok(successful.every(v => v.body.result.orNumber === firstOr),
    "All concurrently successful requests must return the same official receipt");

  // Even if serializable conflicts temporarily exhaust some retries, a user
  // repeating the SAME request should receive the original committed receipt.
  const replay = await post(cookie, "cashier", data);
  assert.equal(replay.status, 200, JSON.stringify(replay.body));
  assert.equal(replay.body.result.orNumber, firstOr);

  const [receipts, requests, deliveries] = await Promise.all([
    prisma.collection.findMany({ where: { organizationId: org.id, orNumber: firstOr } }),
    prisma.paymentRequest.findMany({ where: { organizationId: org.id, requestId: id } }),
    prisma.digitalReceiptDelivery.findMany({ where: {
      organizationId: org.id, referenceNo: firstOr,
    } }),
  ]);
  assert.equal(receipts.length, 1, "No extra posted receipts from concurrent identical requests");
  assert.equal(receipts[0].amountPaid, 40);
  assert.equal(receipts[0].balanceDue, 110);
  const assessedAfterCashier = await prisma.collectible.findFirstOrThrow({
    where: { organizationId: org.id, category: "Membership" },
  });
  assert.equal(assessedAfterCashier.balanceDue, 110,
    "Cashier receipt must reduce the actual student assessment inside its transaction");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].orNumber, firstOr);
  assert.ok(deliveries.length <= 1, "One maximum digital receipt per intended test officer");

  const tampered = await post(cookie, "cashier", { ...data, amountPaid: 41 });
  assert.equal(tampered.status, 409);
  assert.match(tampered.body.error, /different payment details/i);
  assert.equal(await prisma.collection.count({ where: { organizationId: org.id, orNumber: firstOr } }), 1);
});

test("authenticated simultaneous remittance approval produces one receipt, then safe replay", async () => {
  const { cookie, org } = await ciSessionCookie();
  const remit = await prisma.onlineRemittance.findFirstOrThrow({
    where: { organizationId: org.id, submissionId: "CI-FIN-REMIT-001" },
  });
  const data = { remittanceId: remit.id, studentId: remit.studentId,
    studentName: remit.studentName, particulars: remit.itemDescription,
    amount: 20, ay, term, fundAllocation: "General Fund" };
  const results = await Promise.all(
    Array.from({ length: 8 }, () => post(cookie, "remittance", data))
  );
  const accepted = results.filter(v => v.body.success);
  assert.ok(accepted.length > 0, "At least one reviewer must succeed: " + JSON.stringify(results));
  const firstOr = accepted[0].body.result.orNumber;
  assert.ok(accepted.every(v => v.body.result.orNumber === firstOr),
    "Concurrent accepted approvals must all reference the same receipt");

  const retried = await post(cookie, "remittance", data);
  assert.equal(retried.status, 200, JSON.stringify(retried.body));
  assert.equal(retried.body.result.orNumber, firstOr);

  const [latest, receipts, logs] = await Promise.all([
    prisma.onlineRemittance.findUniqueOrThrow({ where: { id: remit.id } }),
    prisma.collection.findMany({ where: { organizationId: org.id, orNumber: firstOr } }),
    prisma.systemLog.findMany({ where: { organizationId: org.id, action: "VERIFY_REMITTANCE" } }),
  ]);
  assert.equal(latest.status, "Verified");
  assert.equal(latest.orNumber, firstOr);
  assert.equal(receipts.length, 1, "One verified payment may create only one OR");
  assert.equal(receipts[0].amountPaid, 20);
  assert.equal(receipts[0].balanceDue, 90);
  assert.equal(receipts[0].category, "Membership",
    "Configured remittance must use the fee category instead of generic Online Remittance");
  assert.equal(receipts[0].fundAllocation, "General Fund");
  const assessedAfterRemittance = await prisma.collectible.findFirstOrThrow({
    where: { organizationId: org.id, category: "Membership" },
  });
  assert.equal(assessedAfterRemittance.balanceDue, 90,
    "Verified remittance must reduce the matched student assessment rather than leaving a phantom due");
  assert.equal(logs.length, 1);

  const mismatch = await post(cookie, "remittance", { ...data, amount: 21 });
  assert.equal(mismatch.status, 409);
  assert.match(mismatch.body.error, /does not match/i);
  assert.equal(await prisma.collection.count({ where: { organizationId: org.id, orNumber: firstOr } }), 1);
});

test("cashier posting rejects a nonexistent target fund", async () => {
  const { cookie, org } = await ciSessionCookie();
  const requestId = randomUUID();
  await prisma.collectionSetup.create({ data: {
    organizationId: org.id, academicYear: ay, term, category: "Other",
    name: "Ad hoc QA Fee", amount: 7,
    targetFund: "Unconfigured Fund", isPackage: false,
  } });
  const before = await prisma.collection.count({ where: { organizationId: org.id } });
  const data = { requestId, date: "2026-10-20", studentId: "CI-FIN-STUDENT-001",
    studentName: "CI Synthetic Student", studentEmail: "", category: "Other",
    itemDescription: "Ad hoc QA Fee", paymentType: "Full Payment",
    standardRate: 7, amountPaid: 7, fundAllocation: "Unconfigured Fund", ay, term };
  const response = await post(cookie, "cashier", data);
  assert.equal(response.status, 409, JSON.stringify(response.body));
  assert.match(response.body.error, /not configured/i);
  assert.equal(await prisma.collection.count({ where: { organizationId: org.id } }), before);
  assert.equal(await prisma.paymentRequest.count({ where: { organizationId: org.id, requestId } }), 0);
});

test("cashier rejects a fabricated client fee even when the destination fund exists", async () => {
  const { cookie, org } = await ciSessionCookie();
  const requestId = randomUUID();
  const priorReceipts = await prisma.collection.count({ where: { organizationId: org.id } });
  const response = await post(cookie, "cashier", {
    requestId, date: "2026-10-20", studentId: "CI-FIN-STUDENT-001",
    studentName: "CI Synthetic Student", studentEmail: "",
    category: "Client-Forged", itemDescription: "Fee Without Setup",
    paymentType: "Full Payment", standardRate: 25000,
    amountPaid: 25000, fundAllocation: "General Fund", ay, term,
  });
  assert.equal(response.status, 409, JSON.stringify(response.body));
  assert.match(response.body.error, /not configured in fee setup/i);
  assert.equal(await prisma.collection.count({ where: { organizationId: org.id } }), priorReceipts);
  assert.equal(await prisma.paymentRequest.count({ where: { organizationId: org.id, requestId } }), 0);
});

test("cashier refuses ambiguous duplicated fee setups", async () => {
  const { cookie, org } = await ciSessionCookie();
  const feeName = "Duplicated QA Fee";
  await prisma.collectionSetup.createMany({ data: [1, 2].map(n => ({
    organizationId: org.id, academicYear: ay, term,
    category: "Other", name: feeName, amount: n * 40,
    targetFund: "General Fund", isPackage: false,
  })) });
  const prior = await prisma.collection.count({ where: { organizationId: org.id } });
  const response = await post(cookie, "cashier", {
    requestId: randomUUID(), date: "2026-10-20", studentId: "CI-FIN-STUDENT-001",
    studentName: "CI Synthetic Student", studentEmail: "", category: "Other",
    itemDescription: feeName, paymentType: "Partial Payment",
    standardRate: 80, amountPaid: 15,
    fundAllocation: "General Fund", ay, term,
  });
  assert.equal(response.status, 409, JSON.stringify(response.body));
  assert.match(response.body.error, /duplicated in fee setup/i);
  assert.equal(await prisma.collection.count({ where: { organizationId: org.id } }), prior);
});

test("cashier rejects the same fee name reused across different categories", async () => {
  const { cookie, org } = await ciSessionCookie();
  await prisma.collectionSetup.createMany({ data: [
    { organizationId: org.id, academicYear: ay, term, category: "Science",
      name: "Cross Category Fee", amount: 100, targetFund: "General Fund", isPackage: false },
    { organizationId: org.id, academicYear: ay, term, category: "Engineering",
      name: "Cross Category Fee", amount: 150, targetFund: "General Fund", isPackage: false },
  ] });
  const before = await prisma.collection.count({ where: { organizationId: org.id } });
  const response = await post(cookie, "cashier", {
    requestId: randomUUID(), date: "2026-10-20",
    studentId: "CI-FIN-STUDENT-001", studentName: "CI Synthetic Student",
    studentEmail: "", category: "Science", itemDescription: "Cross Category Fee",
    paymentType: "Full Payment", standardRate: 100,
    amountPaid: 100, fundAllocation: "General Fund", ay, term,
  });
  assert.equal(response.status, 409, JSON.stringify(response.body));
  assert.match(response.body.error, /duplicated in fee setup/i);
  assert.equal(await prisma.collection.count({ where: { organizationId: org.id } }), before);
});

test("remittance approval rejects fee setups with missing target funds", async () => {
  const { cookie, org } = await ciSessionCookie();
  await prisma.collectionSetup.create({ data: {
    organizationId: org.id, academicYear: ay, term, category: "Other",
    name: "Stale Setup Fund Fee", amount: 50,
    targetFund: "Nonexistent Accounting Pool", isPackage: false,
  } });
  const remit = await prisma.onlineRemittance.create({ data: {
    organizationId: org.id, submissionId: "CI-FIN-REMIT-UNFUNDED",
    academicYear: ay, term, studentId: "CI-FIN-STUDENT-001",
    studentName: "CI Synthetic Student", paymentChannel: "GCash",
    referenceNumber: "CI-FIN-TRANSFER-UNFUNDED", category: "Online Remittance",
    itemDescription: "Stale Setup Fund Fee", paymentMode: "Online",
    amountPaid: 15, status: "Pending Verification",
  } });
  const before = await prisma.collection.count({ where: { organizationId: org.id } });
  const response = await post(cookie, "remittance", {
    remittanceId: remit.id, studentId: remit.studentId,
    studentName: remit.studentName, particulars: remit.itemDescription,
    amount: 15, ay, term, fundAllocation: "General Fund",
  });
  assert.equal(response.status, 409, JSON.stringify(response.body));
  assert.match(response.body.error, /unconfigured fund/i);
  assert.equal(await prisma.collection.count({ where: { organizationId: org.id } }), before);
  const state = await prisma.onlineRemittance.findUniqueOrThrow({ where: { id: remit.id } });
  assert.equal(state.status, "Pending Verification");
  assert.equal(state.orNumber, null);
});

test("online verification rejects an unconfigured ad hoc fee without allocating OR", async () => {
  const { cookie, org } = await ciSessionCookie();
  const remit = await prisma.onlineRemittance.create({ data: {
    organizationId: org.id, submissionId: "CI-FIN-REMIT-ADHOC",
    academicYear: ay, term, studentId: "CI-FIN-STUDENT-001",
    studentName: "CI Synthetic Student", paymentChannel: "Maya",
    referenceNumber: "CI-ADHOC-UNCONFIGURED", category: "Other",
    itemDescription: "Unconfigured Donation", paymentMode: "Online",
    amountPaid: 5, status: "Pending Verification",
  } });
  const before = await prisma.collection.count({ where: { organizationId: org.id } });
  const response = await post(cookie, "remittance", {
    remittanceId: remit.id, studentId: remit.studentId, studentName: remit.studentName,
    particulars: remit.itemDescription, amount: 5, ay, term, fundAllocation: "General Fund",
  });
  assert.equal(response.status, 409, JSON.stringify(response.body));
  assert.match(response.body.error, /not configured in Fee Setup/i);
  assert.equal(await prisma.collection.count({ where: { organizationId: org.id } }), before);
  const current = await prisma.onlineRemittance.findUniqueOrThrow({ where: { id: remit.id } });
  assert.equal(current.status, "Pending Verification");
  assert.equal(current.orNumber, null);
});

test("old uncategorized package proofs cannot silently consume packages across categories", async () => {
  const { cookie, org } = await ciSessionCookie();
  const remit = await prisma.onlineRemittance.create({ data: {
    organizationId: org.id, submissionId: "CI-FIN-REMIT-PKG-LEGACY",
    academicYear: ay, term, studentId: "CI-FIN-STUDENT-001",
    studentName: "CI Synthetic Student", paymentChannel: "GCash",
    referenceNumber: "CI-LEGACY-PACKAGE", category: "Online Remittance",
    itemDescription: "Departmental Fee (Full Package)", paymentMode: "Online",
    amountPaid: 10, status: "Pending Verification",
  } });
  const response = await post(cookie, "remittance", {
    remittanceId: remit.id, studentId: remit.studentId, studentName: remit.studentName,
    particulars: remit.itemDescription, amount: 10, ay, term, fundAllocation: "General Fund",
  });
  assert.equal(response.status, 409, JSON.stringify(response.body));
  assert.match(response.body.error, /explicitly selected fee category/i);
  const current = await prisma.onlineRemittance.findUniqueOrThrow({ where: { id: remit.id } });
  assert.equal(current.status, "Pending Verification");
  assert.equal(current.orNumber, null);
});

test("categorized package remittance cannot charge another category", async () => {
  const { cookie, org } = await ciSessionCookie();
  await prisma.collectionSetup.create({ data: {
    organizationId: org.id, academicYear: ay, term, category: "Merchandise",
    name: "Unrelated Shirt Package", amount: 350, targetFund: "General Fund", isPackage: true,
  } });
  const remit = await prisma.onlineRemittance.create({ data: {
    organizationId: org.id, submissionId: "CI-FIN-REMIT-PKG-CAT",
    academicYear: ay, term, studentId: "CI-FIN-STUDENT-001",
    studentName: "CI Synthetic Student", paymentChannel: "GCash",
    referenceNumber: "CI-CATEGORIZED-PACKAGE", category: "Membership",
    itemDescription: "Departmental Fee (Full Package)", paymentMode: "Online",
    amountPaid: 10, status: "Pending Verification",
  } });
  const response = await post(cookie, "remittance", {
    remittanceId: remit.id, studentId: remit.studentId, studentName: remit.studentName,
    particulars: remit.itemDescription, amount: 10, ay, term, fundAllocation: "General Fund",
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const receiptRows = await prisma.collection.findMany({ where: {
    organizationId: org.id, orNumber: response.body.result.orNumber,
  } });
  assert.equal(receiptRows.length, 1);
  assert.equal(receiptRows[0].category, "Membership");
  assert.equal(receiptRows[0].itemDescription, "Membership Fee");
  assert.equal(receiptRows[0].amountPaid, 10);
  assert.equal(await prisma.collection.count({ where: {
    organizationId: org.id, category: "Merchandise",
  } }), 0);
});

test.after(async () => {
  await prisma.$disconnect();
});
