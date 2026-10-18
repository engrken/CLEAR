/** Historic assessed debt. No imaginary package fees are generated for prior periods. */
import type { Prisma } from "@prisma/client";
import { academicYearStart, configurationForYear, periodsFor, type CalendarByYear } from "@/lib/academic-periods";
import { decodeStudentDue, activeCollectibleDue } from "@/app/department/[department]/(protected)/collectibles/due-link";

export type HistoricalDebt = {
  obligationType: "penalty" | "collectible";
  obligationId: string;
  studentId: string;
  category: string;
  itemDescription: string;
  balanceDue: number;
  originAY: string;
  originTerm: string;
};

export function olderThan(ay: string, term: string, currentAY: string,
    currentTerm: string, calendar: CalendarByYear): boolean {
  const a = academicYearStart(ay), b = academicYearStart(currentAY);
  if (a !== b) return a < b;
  const terms = periodsFor(configurationForYear(currentAY, calendar));
  const i = terms.indexOf(term), j = terms.indexOf(currentTerm);
  return i >= 0 && j >= 0 && i < j;
}

export async function listHistoricalDebts(
  db: Pick<Prisma.TransactionClient, "penalty" | "collectible" | "academicPeriodConfig">,
  organizationId: string, currentAY: string, currentTerm: string,
  studentId?: string
): Promise<HistoricalDebt[]> {
  const calendarRows = await db.academicPeriodConfig.findMany({ where: { organizationId },
    select: { academicYear: true, mode: true, includeSummer: true } });
  const calendars: CalendarByYear = Object.fromEntries(calendarRows.map(x => [x.academicYear, {
    mode: x.mode as "Semester" | "Trimester" | "FullYear", includeSummer: x.includeSummer,
  }]));
  const [penalties, dues] = await Promise.all([
    db.penalty.findMany({ where: { organizationId, fineAmount: { gt: 0 },
      ...(studentId ? { studentId: { equals: studentId, mode: "insensitive" as const } } : {}) } }),
    db.collectible.findMany({ where: { organizationId, balanceDue: { gt: 0 } } }),
  ]);
  const out: HistoricalDebt[] = [];
  for (const pen of penalties) {
    if (!pen.studentId || /VOID|CANCEL|^SETTLED/i.test(pen.status || "")) continue;
    if (!olderThan(pen.academicYear, pen.term, currentAY, currentTerm, calendars)) continue;
    out.push({ obligationType: "penalty", obligationId: pen.id,
      studentId: pen.studentId, category: "Penalty", itemDescription: pen.activity,
      balanceDue: Number(pen.fineAmount), originAY: pen.academicYear, originTerm: pen.term });
  }
  for (const due of dues) {
    if (!activeCollectibleDue(due)) continue;
    const marker = decodeStudentDue(due.status);
    if (!marker || (studentId && marker.studentId.toLowerCase() !== studentId.toLowerCase())) continue;
    if (!olderThan(due.academicYear, due.term, currentAY, currentTerm, calendars)) continue;
    out.push({ obligationType: "collectible", obligationId: due.id,
      studentId: marker.studentId, category: due.category, itemDescription: marker.itemDescription,
      balanceDue: Number(due.balanceDue), originAY: due.academicYear, originTerm: due.term });
  }
  return out;
}
