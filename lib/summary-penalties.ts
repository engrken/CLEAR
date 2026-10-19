/**
 * Summary-report-only aggregation of unpaid cash-only penalties.
 *
 * All assessed penalties (including service-eligible ones) remain in Penalty
 * Logs and clearance checks. Never use activity text to infer cash-only status.
 */
export type SummaryPenaltyRecord = {
  penaltyType: string;
  status: string | null;
  studentId: string | null;
  studentName: string | null;
  fineAmount: number | null;
};

export function summarizeCashOnlyPenaltyObligations(
  penalties: readonly SummaryPenaltyRecord[],
): { count: number; amount: number } {
  const affectedStudents = new Set<string>();
  let outstandingCents = 0;

  for (const penalty of penalties) {
    if (penalty.penaltyType !== "LATE_FEE") continue;
    if (/VOID|CANCEL/i.test(penalty.status || "")) continue;

    // Penalty.fineAmount is the live outstanding amount, not the original fine.
    const cents = Math.round(Number(penalty.fineAmount ?? 0) * 100);
    if (!Number.isFinite(cents) || cents <= 0) continue;

    const studentKey = String(penalty.studentId || penalty.studentName || "")
      .trim()
      .toLowerCase();
    if (studentKey) affectedStudents.add(studentKey);
    outstandingCents += cents;
  }

  return { count: affectedStudents.size, amount: outstandingCents / 100 };
}
