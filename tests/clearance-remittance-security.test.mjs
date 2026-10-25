import test from "node:test";
import assert from "node:assert/strict";
import { isClosedPenaltyStatus, isOutstandingPenalty, isCanonicalPenaltyReceipt } from "../lib/penalty-clearance-status.ts";
import { ingressClientIp, normalizePublicPaymentChannel } from "../lib/public-remittance-security.ts";

test("UNSETTLED does not match SETTLED: cash and service penalties with a positive balance remain owed", () => {
  for (const status of ["Unsettled", "UNSETTLED", "Partially Paid (Cash Payment)", "Pending"]) {
    assert.equal(isClosedPenaltyStatus(status), false, status);
    assert.equal(isOutstandingPenalty({ status, fineAmount: 120.5 }), true, status);
  }
});

test("closed, voided, cancelled and zero-balance penalties do not impose current-term holds", () => {
  for (const status of ["Settled", "Settled (Cash Payment)", "VOIDED", "Cancelled"]) {
    assert.equal(isClosedPenaltyStatus(status), true, status);
    assert.equal(isOutstandingPenalty({ status, fineAmount: 250 }), false, status);
  }
  for (const amount of [0, -50, Number.NaN, Infinity, null]) {
    assert.equal(isOutstandingPenalty({ status: "Unsettled", fineAmount: amount }), false);
  }
});

test("strict payment channels, with harmless capitalization aliases", () => {
  for (const [input, expected] of [
    ["GCash", "GCash"], [" gcash ", "GCash"], ["Maya", "Maya"],
    ["PayMaya", "Maya"], [" Bank   Transfer ", "Bank Transfer"],
  ]) assert.equal(normalizePublicPaymentChannel(input), expected);
  for (const input of ["Cash", "crypto", "", null, "Bank Transfer;drop table", "GCash,Maya"]) {
    assert.equal(normalizePublicPaymentChannel(input), null);
  }
});

test("uses last trusted-proxy hop for IP throttle instead of spoofable first XFF hop", () => {
  const headers = new Headers({
    "x-forwarded-for": "198.51.100.1, 203.0.113.7",
    "x-real-ip": "192.0.2.99",
  });
  assert.equal(ingressClientIp(headers), "203.0.113.7");
  assert.equal(ingressClientIp(new Headers({ "x-real-ip": "192.0.2.3" })), "192.0.2.3");
  assert.equal(ingressClientIp(new Headers()), "unknown");
});

test("community-service settlement does not leave a phantom ₱10 hold from a linked partial cash OR", () => {
  const student = { id: 'synthetic-student-db', studentId: 'SYN-STUDENT-0001' };
  const penaltyId = 'PEN-FA7547E1-D383-4461-9971-E704C851E8E0';
  const receipt = {
    studentId: student.id, academicYear: 'A.Y. 2026 - 2027', term: '1st Sem',
    itemDescription: `Penalty Fine [${penaltyId}]: sample infraction`,
    standardRate: 30, amountPaid: 20, balanceDue: 10,
  };
  const linked = [{
    penaltyId, studentId: student.studentId,
    academicYear: receipt.academicYear, term: receipt.term,
    fineAmount: 0, status: 'Settled (Community Service)',
  }];
  assert.equal(isCanonicalPenaltyReceipt(receipt, student, linked), true);
  assert.equal(isOutstandingPenalty(linked[0]), false);
  // The ₱20 OR, ₱10 service credit and ₱0 remaining Penalty are retained.
  assert.equal(receipt.balanceDue, 10, 'historical cash OR remains unchanged');
  assert.equal(receipt.amountPaid, 20);
  assert.equal(linked[0].fineAmount, 0);
});

test("partially paid linked penalty imposes only canonical remaining penalty balance", () => {
  const student = { id: 'synthetic-student-db', studentId: 'SYN-STUDENT-0001' };
  const penaltyId = 'PEN-FA7547E1-D383-4461-9971-E704C851E8E0';
  const receipt = {
    studentId: student.id, academicYear: 'A.Y. 2026 - 2027', term: '1st Sem',
    itemDescription: `Penalty Fine [${penaltyId}]: infraction`,
    standardRate: 30, amountPaid: 20, balanceDue: 10,
  };
  const penalty = { penaltyId, studentId: student.studentId,
    academicYear: receipt.academicYear, term: receipt.term,
    fineAmount: 10, status: 'Partially Paid (Cash Payment)' };
  assert.equal(isCanonicalPenaltyReceipt(receipt, student, [penalty]), true);
  assert.equal(isOutstandingPenalty(penalty), true, 'unsettled ₱10 still imposes hold');
});

test("unrelated receipt, mismatched student, term or penalty reference never hides a debt", () => {
  const student = { id: 'synthetic-student-db', studentId: 'SYN-STUDENT-0001' };
  const penaltyId = 'PEN-FA7547E1-D383-4461-9971-E704C851E8E0';
  const receipt = {
    studentId: student.id, academicYear: 'A.Y. 2026 - 2027', term: '1st Sem',
    itemDescription: `Penalty Fine [${penaltyId}]: infraction`,
  };
  const linked = { penaltyId, studentId: student.studentId,
    academicYear: receipt.academicYear, term: receipt.term, fineAmount: 0 };
  assert.equal(isCanonicalPenaltyReceipt(receipt, student, []), false);
  assert.equal(isCanonicalPenaltyReceipt({ ...receipt, studentId: 'other-person' }, student, [linked]), false);
  assert.equal(isCanonicalPenaltyReceipt({ ...receipt, term: '2nd Sem' }, student, [linked]), false);
  assert.equal(isCanonicalPenaltyReceipt({ ...receipt, academicYear: 'A.Y. 2027 - 2028' }, student, [linked]), false);
  assert.equal(isCanonicalPenaltyReceipt({ ...receipt,
    itemDescription: 'Other fee mentioning ' + penaltyId }, student, [linked]), false);
  assert.equal(isCanonicalPenaltyReceipt({ ...receipt, itemDescription: 'Normal penalty ₱10' }, student, [linked]), false);
  assert.equal(isCanonicalPenaltyReceipt(receipt, student, [{ ...linked, fineAmount: NaN }]), false);
});
