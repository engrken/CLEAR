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

/**
 * A receipt for a named, explicitly linked penalty is an audit/payment record,
 * NOT a second assessed fee. The live Penalty.fineAmount and settlement events
 * already account for cash, community service and reversals. Counting a
 * partial-payment Collection.standardRate minus amountPaid as an independent
 * debt creates a phantom hold after community service has settled the fine.
 *
 * Fail closed: suppress ONLY exact issued "Penalty Fine [PEN-UUID]: ..." lines
 * linked to a real, same-student, same-academic-period penalty. Never suppress
 * ordinary Others/standalone fees or free-form descriptions that merely mention
 * a penalty ID. No changes to receipts or accounting data are made here.
 */
export function isCanonicalPenaltyReceipt(
  receipt: {
    itemDescription?: unknown; studentId?: unknown;
    academicYear?: unknown; term?: unknown;
  },
  student: { id: string; studentId: string },
  penalties: Array<{
    penaltyId?: unknown; studentId?: unknown;
    academicYear?: unknown; term?: unknown;
    fineAmount?: unknown;
  }>,
): boolean {
  const text = String(receipt.itemDescription ?? '').trim();
  const match = /^Penalty Fine \[(PEN-[0-9A-F]{8}(?:-[0-9A-F]{4}){3}-[0-9A-F]{12})\]:\s*\S/i.exec(text);
  if (!match) return false;
  const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
  const sid = norm(student.studentId);
  const dbid = norm(student.id);
  const receiptStudent = norm(receipt.studentId);
  if (!receiptStudent || (receiptStudent !== dbid && receiptStudent !== sid)) return false;
  return penalties.some(p => {
    const amount = Number(p.fineAmount);
    return norm(p.penaltyId) === norm(match[1]) &&
      (norm(p.studentId) === sid || norm(p.studentId) === dbid) &&
      norm(p.academicYear) === norm(receipt.academicYear) &&
      norm(p.term) === norm(receipt.term) &&
      Number.isFinite(amount) && amount >= 0;
  });
}
