/**
 * Penalty balances that must keep a student on clearance hold.
 *
 * A substring check for SETTLED is incorrect because "UNSETTLED" contains it.
 * Keep this status policy shared between web and future mobile clearance.
 */
export function isClosedPenaltyStatus(status: unknown): boolean {
  const normalized = String(status ?? "").trim().toUpperCase();
  return normalized.startsWith("SETTLED") ||
    normalized.includes("VOID") ||
    normalized.includes("CANCEL");
}

export function isOutstandingPenalty(
  penalty: { status?: unknown; fineAmount?: unknown },
): boolean {
  const amount = Number(penalty.fineAmount ?? 0);
  return Number.isFinite(amount) &&
    amount > 0 &&
    !isClosedPenaltyStatus(penalty.status);
}
