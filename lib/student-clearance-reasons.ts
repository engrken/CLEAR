/**
 * Student-self-service clearance explanations.
 *
 * Call ONLY after requireStudentClearanceSession + exact student/tenant/period
 * revalidation. These are derived from the existing live hold calculation;
 * never use this projection to grant clearance or issue a QR.
 *
 * Deliberately excludes student identity, receipt IDs, payment references,
 * free-form officer notes, and cash-advance IDs. An approved cash advance is
 * NOT a payable balance, so it has a null monetary amount.
 */
export type StudentHoldReason = {
  kind: 'enrollment' | 'package' | 'penalty' | 'collectible' | 'previous_period' | 'cash_advance' | 'assessment';
  label: string;
  amountCentavos: number | null;
  academicYear?: string;
  term?: string;
};

export type ClearanceUnpaidReasonSource = {
  category: string;
  itemDescription: string;
  balanceDue: number;
  originAy?: string;
  originTerm?: string;
};

function shortLabel(value: string, fallback: string): string {
  // Strip control characters to avoid leaking malformed/internal metadata to UI.
  return (String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 110) || fallback);
}

export function buildVerifiedStudentReasons(
  isEnrolled: boolean,
  unpaidItems: readonly ClearanceUnpaidReasonSource[],
  toExactCentavos: (pesos: number) => number,
): StudentHoldReason[] {
  const reasons: StudentHoldReason[] = [];
  if (!isEnrolled) {
    reasons.push({
      kind: 'enrollment',
      label: 'Enrollment has not been confirmed for the current term.',
      amountCentavos: null,
    });
  }
  for (const unpaid of unpaidItems) {
    const category = String(unpaid.category || '').toLowerCase();
    const previous = Boolean(unpaid.originAy || unpaid.originTerm);
    const isAdvance = category.includes('cash advance');
    let kind: StudentHoldReason['kind'];
    let label: string;
    if (previous) {
      kind = 'previous_period';
      label = shortLabel(unpaid.itemDescription, 'Outstanding previous-period obligation');
    } else if (isAdvance) {
      kind = 'cash_advance';
      label = 'Cash advance awaiting liquidation';
    } else if (category.includes('penalty') || category.includes('fine')) {
      kind = 'penalty';
      label = 'Unsettled fine or penalty';
    } else if (unpaid.itemDescription === 'Mandatory Package Balance') {
      kind = 'package';
      label = 'Mandatory departmental package balance';
    } else if (category.includes('collectible')) {
      kind = 'collectible';
      label = shortLabel(unpaid.itemDescription, 'Outstanding collectible');
    } else {
      kind = 'assessment';
      label = shortLabel(unpaid.itemDescription, 'Outstanding assessed fee');
    }
    const amountCentavos = isAdvance ? null : toExactCentavos(unpaid.balanceDue);
    if (amountCentavos !== null && (!Number.isSafeInteger(amountCentavos) || amountCentavos < 0)) {
      throw new Error('Invalid student clearance obligation amount.');
    }
    reasons.push({
      kind,
      label,
      amountCentavos,
      ...(previous && unpaid.originAy ? { academicYear: shortLabel(unpaid.originAy, '') } : {}),
      ...(previous && unpaid.originTerm ? { term: shortLabel(unpaid.originTerm, '') } : {}),
    });
  }
  return reasons;
}
