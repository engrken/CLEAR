import test from "node:test";
import assert from "node:assert/strict";
import { itemizeCollectionsForSummary } from "../lib/summary-collections.ts";

const receipt = (overrides = {}) => ({
  studentId: "student-1",
  studentName: "Sample Student",
  category: "Departmental Fee",
  itemDescription: "COE FCUSR Activities",
  amountPaid: 100,
  status: "Valid",
  paymentType: "Full Payment",
  ...overrides,
});

const setups = [
  { category: "Departmental Fee", name: "COE FCUSR Activities", amount: 100, isPackage: true },
  { category: "Departmental Fee", name: "Orientation", amount: 200, isPackage: true },
  { category: "Departmental Fee", name: "Membership Fee", amount: 250, isPackage: true },
  { category: "Departmental Fee", name: "Sports Fund", amount: 100, isPackage: true },
  { category: "Merchandise", name: "Departmental Shirt", amount: 400, isPackage: false },
];

function allCents(result) {
  return result.reduce((total, category) => total +
    category.items.reduce((sum, item) => sum + Math.round(item.amount * 100), 0), 0);
}

test("collection categories have child lines only, and distinct students per item", () => {
  const rows = [
    receipt({ studentId: "s1", amountPaid: 100 }),
    receipt({ studentId: "s2", amountPaid: 100 }),
    receipt({ studentId: "s1", amountPaid: 50 }),
    receipt({ studentId: "s1", category: "Merchandise", itemDescription: "Departmental Shirt", amountPaid: 200 }),
  ];
  const result = itemizeCollectionsForSummary(rows, setups);
  assert.deepEqual(result, [
    { category: "Departmental Fee", items: [{ name: "COE FCUSR Activities", count: 2, amount: 250 }] },
    { category: "Merchandise", items: [{ name: "Departmental Shirt", count: 1, amount: 200 }] },
  ]);
  assert.equal(allCents(result), 45000);
  assert.equal(JSON.stringify(result).includes("Sample Student"), false);
  assert.equal(JSON.stringify(result).includes("student-1"), false);
});

test("one consolidated package payment splits into real fee items with exact centavos", () => {
  const paid = 649.99;
  const rows = [receipt({
    category: "Departmental Fee",
    itemDescription: "Departmental Fee Package (All Items)",
    amountPaid: paid,
  })];
  const result = itemizeCollectionsForSummary(rows, setups);
  assert.equal(result.length, 1);
  assert.equal(result[0].category, "Departmental Fee");
  assert.equal(result[0].items.length, 4);
  assert.equal(allCents(result), 64999);
  assert.ok(result[0].items.every(item => item.count === 1));
});

test("voided, cancelled, and zero-paid assessments cannot appear as collections", () => {
  const result = itemizeCollectionsForSummary([
    receipt({ amountPaid: 100, status: "VOIDED" }),
    receipt({ amountPaid: 200, paymentType: "VOID: incorrect receipt" }),
    receipt({ amountPaid: 99, status: "Cancelled" }),
    receipt({ amountPaid: 0, paymentType: "Unpaid" }),
  ], setups);
  assert.deepEqual(result, []);
});

test("the actual Others Penalty / Fines receipt is labeled accurately", () => {
  const result = itemizeCollectionsForSummary([
    receipt({ category: "Others", itemDescription: "Penalty / Fines", amountPaid: 442 }),
  ], setups);
  assert.deepEqual(result, [{
    category: "Penalty / Fines",
    items: [{ name: "Penalty / Fines", count: 1, amount: 442 }],
  }]);
});

test("legacy per-student penalty references are not shown as item names", () => {
  const result = itemizeCollectionsForSummary([
    receipt({ category: "Penalty", itemDescription: "Penalty Fine [PEN-000011]", amountPaid: 12 }),
    receipt({ category: "Penalty", itemDescription: "Penalty Fine [PEN-000012]", studentId: "s2", amountPaid: 8 }),
  ], setups);
  assert.deepEqual(result, [{
    category: "Penalty",
    items: [{ name: "Penalty / Fines", count: 2, amount: 20 }],
  }]);
});

test("receipt sums reconcile over normal fee, merchandise, fines and carry-over", () => {
  const rows = [
    receipt({ studentId: "A", amountPaid: 100 }),
    receipt({ studentId: "B", amountPaid: 100 }),
    receipt({ category: "Merchandise", itemDescription: "Departmental Shirt", amountPaid: 350 }),
    receipt({ category: "General Fund", itemDescription: "General Fund (Carried Over)", amountPaid: 23131 }),
    receipt({ category: "Others", itemDescription: "Penalty / Fines", amountPaid: 442 }),
  ];
  const result = itemizeCollectionsForSummary(rows, setups);
  assert.equal(allCents(result), Math.round(rows.reduce((sum, x) => sum + x.amountPaid, 0) * 100));
  assert.equal(result.length, 4);
});
