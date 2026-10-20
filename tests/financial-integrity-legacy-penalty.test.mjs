import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canOfferLegacyCashReconciliation } from "../lib/penalty-reconciliation-eligibility.ts";

const settledCash = { status: "Settled (Cash Payment)", fineAmount: 0 };
const assessment = [{ method: "ASSESSMENT" }];

test("verified manual penalty receipts must not display Reconcile Old Cash Status", () => {
  // JIECEP OR 26-556 and 26-557 have verified CASH_PAYMENT events.
  for (const orNumber of ["26-556", "26-557"]) {
    const history = [...assessment, { method: "CASH_PAYMENT", orNumber }];
    assert.equal(canOfferLegacyCashReconciliation(settledCash, history, true, false), false, orNumber);
  }
});

test("any settled penalty with payment/service/void history is ineligible for the legacy shortcut", () => {
  for (const method of [
    "CASH_PAYMENT", "LEGACY_CASH", "LEGACY_VOID_RECEIPT",
    "CASH_REVERSAL", "COMMUNITY_SERVICE", "LEGACY_SERVICE",
  ]) {
    assert.equal(canOfferLegacyCashReconciliation(settledCash, [...assessment, { method }], true, false), false, method);
  }
});

test("genuinely unlinked historical cash status remains visible only to an admin in an open term", () => {
  assert.equal(canOfferLegacyCashReconciliation(settledCash, assessment, true, false), true);
  assert.equal(canOfferLegacyCashReconciliation(settledCash, undefined, true, false), true);
  assert.equal(canOfferLegacyCashReconciliation(settledCash, assessment, false, false), false);
  assert.equal(canOfferLegacyCashReconciliation(settledCash, assessment, true, true), false);
  assert.equal(canOfferLegacyCashReconciliation({ status: "Unsettled / Unpaid", fineAmount: 50 }, assessment, true, false), false);
  assert.equal(canOfferLegacyCashReconciliation({ status: "Settled (Community Service - 4 hrs rendered)", fineAmount: 0 }, assessment, true, false), false);
  assert.equal(canOfferLegacyCashReconciliation({ status: "Settled (Cash Payment)", fineAmount: 50 }, assessment, true, false), false);
});

test("the legacy-reopen action checks stored settlement/arrears references on the server", () => {
  const src = readFileSync(new URL("../app/department/[department]/(protected)/penalties/actions.ts",import.meta.url), "utf8");
  const manager = readFileSync(new URL("../app/department/[department]/(protected)/penalties/PenaltiesManager.tsx",import.meta.url), "utf8");
  const fn = src.split("export async function reconcileLegacyCashSettlement")[1].split("function toCentsSafe")[0];
  assert.match(fn, /tx\.penaltySettlementEvent\.findFirst/);
  assert.match(fn, /penaltyRecordId: pen\.id/);
  assert.match(fn, /tx\.arrearPaymentLink\.findFirst/);
  assert.match(manager, /canOfferLegacyCashReconciliation\(p, historyByPenalty\[p\.id\], canReconcile, periodClosed\)/);
});
