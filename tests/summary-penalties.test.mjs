import test from "node:test";
import assert from "node:assert/strict";
import { summarizeCashOnlyPenaltyObligations } from "../lib/summary-penalties.ts";

const record = (overrides = {}) => ({
  penaltyType: "LATE_FEE",
  status: "Unsettled",
  studentId: "24-CECE1-001",
  studentName: "Test Student",
  fineAmount: 100,
  ...overrides,
});

test("summary counts only cash-only unpaid penalties, excluding service eligible assessments", () => {
  const result = summarizeCashOnlyPenaltyObligations([
    record({ fineAmount: 150.25, studentId: "ID-A" }),
    record({ penaltyType: "SERVICE_ELIGIBLE", fineAmount: 500, studentId: "ID-B" }),
    record({ penaltyType: "SERVICE_ELIGIBLE", activity: "Late enrollment", fineAmount: 250, studentId: "ID-C" }),
    record({ fineAmount: 25.5, studentId: "ID-D" }),
  ]);
  assert.deepEqual(result, { count: 2, amount: 175.75 });
});

test("multiple unpaid cash-only fees for the same student are summed but counted once", () => {
  const result = summarizeCashOnlyPenaltyObligations([
    record({ studentId: "STU-1", fineAmount: 49.99 }),
    record({ studentId: "stu-1", fineAmount: 20.01 }),
    record({ studentId: "STU-2", fineAmount: 12.5 }),
  ]);
  assert.deepEqual(result, { count: 2, amount: 82.5 });
});

test("voided, cancelled, settled, and zero-balance fees are excluded", () => {
  const result = summarizeCashOnlyPenaltyObligations([
    record({ status: "VOIDED", fineAmount: 300 }),
    record({ status: "Cancelled", fineAmount: 200 }),
    record({ status: "Settled (Cash Payment)", fineAmount: 0 }),
    record({ status: "Unsettled", fineAmount: -5 }),
    record({ status: "Partially Paid", fineAmount: 19.25 }),
  ]);
  assert.deepEqual(result, { count: 1, amount: 19.25 });
});

test("blank student IDs use normalized names to count distinct affected students", () => {
  const result = summarizeCashOnlyPenaltyObligations([
    record({ studentId: null, studentName: "Late Enrollee", fineAmount: 10 }),
    record({ studentId: null, studentName: "late enrollee", fineAmount: 20 }),
  ]);
  assert.deepEqual(result, { count: 1, amount: 30 });
});

test("no qualifying cash-only late fees produces a zero liability", () => {
  assert.deepEqual(summarizeCashOnlyPenaltyObligations([
    record({ penaltyType: "SERVICE_ELIGIBLE", fineAmount: 999 }),
  ]), { count: 0, amount: 0 });
});
