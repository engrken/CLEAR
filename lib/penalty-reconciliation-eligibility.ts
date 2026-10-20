/**
 * "Reconcile Old Cash Status" is ONLY for imported, zero-balance cash-settled
 * penalties that genuinely lack penalty-specific payment/settlement evidence.
 *
 * Legacy status text alone is not proof that a penalty has no receipt.
 * Never offer the dangerous "reopen" shortcut after a linked receipt, cash
 * settlement, reversal or community-service credit is already on record.
 */
export function canOfferLegacyCashReconciliation(
  penalty: { status: string; fineAmount: number },
  history: ReadonlyArray<{ method: string }> | undefined,
  canReconcile: boolean,
  periodClosed: boolean,
): boolean {
  if (!canReconcile || periodClosed) return false;
  if (!/^SETTLED\s*\(CASH PAYMENT/i.test(penalty.status || "")) return false;
  if (!Number.isFinite(Number(penalty.fineAmount)) || Number(penalty.fineAmount) !== 0) return false;
  return !(history ?? []).some(row => row.method !== "ASSESSMENT");
}
