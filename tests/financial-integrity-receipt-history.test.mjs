import test from "node:test";
import assert from "node:assert/strict";
import { buildReceiptHistoryRows, filterReceiptHistory } from "../lib/receipt-history-grouping.ts";

const status = (group) => {
  const voided = group.filter(line => /VOID|CANCEL|REJECT/i.test(`${line.status} ${line.paymentType}`)).length;
  if (voided === group.length) return "Voided";
  return voided ? "Inconsistent" : "Valid";
};

const make = (orNumber, itemDescription, amountPaid, extra = {}) => ({
  orNumber,
  itemDescription,
  amountPaid,
  studentName: "PACARDO, AVEL",
  studentId: "internal-uuid-avel",
  studentNumber: "25-CECE1-0017",
  academicYear: "A.Y. 2026 - 2027",
  term: "1st Sem",
  date: new Date("2026-09-03T00:00:00.000Z"),
  timestamp: new Date("2026-09-03T13:20:03.000Z"),
  encodedBy: null,
  status: "Valid",
  paymentType: "Full Payment",
  category: "Departmental Fee",
  ...extra,
});

const legacyPackage = [
  make("26-376", "Membership", 250),
  make("26-376", "General Orientation", 200),
  make("26-376", "FCUSR Activities", 100),
  make("26-376", "Sports and Cultural", 100),
];

test("legacy packages count once and remain valid (PACARDO OR 26-376)", () => {
  const rows = buildReceiptHistoryRows(legacyPackage, status);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].orNumber, "26-376");
  assert.equal(rows[0].status, "Valid");
  assert.equal(rows[0].total, 650);
  assert.equal(rows[0].count, 4);
});

test("modern suffix-split package and legacy base lines both count once", () => {
  const modern = [
    make("26-377", "Membership", 250),
    make("26-377-P02", "Orientation", 200),
    make("26-377-P03", "FCUSR", 100),
    make("26-377-P04", "Sports", 100),
  ];
  const rows = buildReceiptHistoryRows([...legacyPackage, ...modern], status);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => row.total), [650, 650].sort(() => 0));
  assert.ok(rows.every(row => row.status === "Valid" && row.count === 4));
});

test("mixed void and valid package lines remain flagged inconsistent", () => {
  const rows = buildReceiptHistoryRows([
    ...legacyPackage.slice(0, 3),
    make("26-376", "Sports and Cultural", 100, { status: "Voided" }),
  ], status);
  assert.equal(rows[0].status, "Inconsistent");
});

test("cross-student OR collision is inconsistent, not another valid package", () => {
  const rows = buildReceiptHistoryRows([
    ...legacyPackage,
    make("26-376", "Fee", 1, { studentId: "another-student", studentName: "OTHER" }),
  ], status);
  assert.equal(rows[0].status, "Inconsistent");
});

test("orphan P02 receipt line is not shown as issued", () => {
  assert.equal(buildReceiptHistoryRows([make("26-999-P02", "Fee", 100)], status).length, 0);
});

test("exact OR, category, status and date filters count receipts, not allocations", () => {
  const rows = buildReceiptHistoryRows([...legacyPackage, make("26-390", "Other", 50, {
    category: "Others", date: new Date("2026-09-08T00:00:00.000Z") })], status);
  const filters = { academicYear: "A.Y. 2026 - 2027", term: "1st Sem",
    search: "", exactOr: "26-376", category: "Departmental Fee",
    from: "2026-09-01", to: "2026-09-03", status: "valid" };
  assert.equal(filterReceiptHistory(rows, filters).length, 1);
  assert.equal(filterReceiptHistory(rows, { ...filters, exactOr: "26-556" }).length, 0);
  assert.equal(filterReceiptHistory(rows, { ...filters, from: "2026-09-04" }).length, 0);
  assert.equal(filterReceiptHistory(rows, { ...filters, status: "inconsistent" }).length, 0);
});

test("receipt grouping helper contains no financial mutations", () => {
  // Pure grouping functions return summaries and never alter source records.
  const untouched = legacyPackage.map(row => ({ ...row }));
  buildReceiptHistoryRows(legacyPackage, status);
  assert.deepEqual(legacyPackage, untouched);
});
