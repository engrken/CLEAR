/** Server-only transaction guard for financial writes by academic period. */
import type { Prisma } from "@prisma/client";
import { configurationForYear, isValidPeriod, type CalendarByYear } from "./academic-periods";

export async function assertAcademicPeriod(
  db: Pick<Prisma.TransactionClient, "academicPeriodConfig" | "academicPeriodTransition">,
  organizationId: string,
  ay: string,
  term: string,
): Promise<void> {
  const rows = await db.academicPeriodConfig.findMany({
    where: { organizationId }, select: { academicYear: true, mode: true, includeSummer: true },
  });
  const calendars: CalendarByYear = Object.fromEntries(rows.map(x => [x.academicYear, {
    mode: x.mode as "Semester" | "Trimester" | "FullYear", includeSummer: x.includeSummer,
  }]));
  const closed = await db.academicPeriodTransition.findFirst({
    where: { organizationId, sourceAY: ay, sourceTerm: term, status: "Closed" },
    select: { destinationAY: true, destinationTerm: true },
  });
  if (closed) throw new Error(
    `Accounting period ${term} (${ay}) is closed. New transactions belong to ${closed.destinationTerm} (${closed.destinationAY}).`
  );
  if (!isValidPeriod(ay, term, configurationForYear(ay, calendars))) {
    throw new Error(`Academic period ${term} (${ay}) is not enabled for this organization. Update System Setup or select a valid period.`);
  }
}
