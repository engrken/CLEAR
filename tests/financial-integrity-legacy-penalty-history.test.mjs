import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const page = read("app/department/[department]/(protected)/penalties/page.tsx");
const manager = read("app/department/[department]/(protected)/penalties/PenaltiesManager.tsx");

test("legacy receipt candidates resolve external student number to same-tenant Student UUID", () => {
  assert.match(page, /select: \{ id: true, studentId: true, fullName: true, email: true \}/);
  assert.match(page, /new Map\(students\.map\(student => \[student\.studentId, student\.id\]\)\)/);
  assert.match(page, /studentId: \{ in: studentPks \}/);
  assert.match(page, /organizationId: organization\.id,\s*academicYear: ay,\s*term,/);
  assert.match(page, /new Date\(receipt\.date\)\.getTime\(\) >= assessedAt/);
});

test("candidate receipts must lack existing structured settlement and arrears links", () => {
  assert.match(page, /penaltySettlementEvents: \{ none: \{\} \}/);
  assert.match(page, /arrearPaymentLinks: \{ none: \{\} \}/);
  assert.match(page, /explicitlyMatchedReceiptIds\.has\(receipt\.id\)/);
});

test("generic legacy penalty or fine receipt descriptions are discoverable", () => {
  assert.match(page, /itemDescription: \{ contains: "penalty", mode: "insensitive" \}/);
  assert.match(page, /itemDescription: \{ contains: "fine", mode: "insensitive" \}/);
  assert.match(page, /category: \{ contains: "penalty", mode: "insensitive" \}/);
});

test("history presents unmatched ORs without counting them as allocated settlement", () => {
  assert.match(page, /unlinkedReceiptsByPenalty=\{unlinkedReceiptsByPenalty\}/);
  assert.match(manager, /Unlinked historical penalty\/fine receipts/);
  assert.match(manager, /NOT linked to this particular penalty/);
  assert.match(manager, /not counted as settlement or assigned automatically/);
  assert.match(manager, /receipt\.orNumber/);
  assert.match(manager, /receipt\.amount/);
  assert.match(manager, /const rows = historyByPenalty\[active\.id\]/);
  assert.match(manager, /const candidateReceipts = unlinkedReceiptsByPenalty\[active\.id\]/);
});

test("history rendering and candidate discovery never mutate financial records", () => {
  assert.doesNotMatch(page, /prisma\.\w+\.(?:update|upsert|create|delete|createMany|updateMany|deleteMany)\(/);
  assert.match(manager, /no linked settlement entry was found/);
});
