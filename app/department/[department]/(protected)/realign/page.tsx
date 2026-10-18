// app/department/[department]/(protected)/realign/page.tsx
import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
import RealignManager from "./RealignManager";
import { CARRIED_GENERAL_FUND, getNextPeriod, getPeriodLedger } from "./ledger";
import type { Metadata } from "next";
import { followingAcademicYear, type CalendarByYear } from "@/lib/academic-periods";

export const metadata: Metadata = {
  title: "Centralized Liquidation of Expenses & Audit Records",
};
export const dynamic = "force-dynamic";

export default async function RealignPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{ ay?: string; term?: string }>;
}) {
  const { department } = await params;
  const cleanDepartment = decodeURIComponent(department).trim().toLowerCase();

  // Same permission used by the realignment server actions.
  await requireTabAccess("tab-transfer", cleanDepartment);

  const search = searchParams ? await searchParams : {};
  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment },
    select: { id: true, activeAy: true, activeTerm: true },
  });
  if (!organization) {
    return (
      <div className="alert alert-danger p-4 shadow-sm border-secondary">
        <h4 className="fw-bold">Department Not Found</h4>
        The department &apos;{cleanDepartment}&apos; does not exist.
      </div>
    );
  }

  const ay = search.ay || organization.activeAy || "A.Y. 2026 - 2027";
  const term = search.term || organization.activeTerm || "1st Sem";

  let nextPeriod: { ay: string; term: string };
  let calendarConfigs: CalendarByYear = {};
  try {
    const upcomingAy = followingAcademicYear(ay);
    const calendarRows = await prisma.academicPeriodConfig.findMany({
      where: { organizationId: organization.id, academicYear: { in: [ay, upcomingAy] } },
      select: { academicYear: true, mode: true, includeSummer: true },
    });
    calendarConfigs = Object.fromEntries(calendarRows.map(row => [row.academicYear, {
      mode: row.mode as "Semester" | "Trimester" | "FullYear", includeSummer: row.includeSummer,
    }]));
    nextPeriod = getNextPeriod(ay, term, calendarConfigs);
  } catch (error) {
    return (
      <div className="alert alert-warning">
        {error instanceof Error ? error.message : "Invalid accounting period."}
      </div>
    );
  }

  const [sourceFeeCount, destFeeCount, sourceLedger, nextLedger] = await Promise.all([
    prisma.collectionSetup.count({ where: { organizationId: organization.id, academicYear: ay, term } }),
    prisma.collectionSetup.count({ where: { organizationId: organization.id, academicYear: nextPeriod.ay, term: nextPeriod.term } }),
    getPeriodLedger(prisma, organization.id, ay, term),
    getPeriodLedger(prisma, organization.id, nextPeriod.ay, nextPeriod.term),
  ]);

  const destinationBalance =
    nextLedger.funds.find(f => f.name === CARRIED_GENERAL_FUND)?.balance ?? 0;

  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm bg-body text-body">
      <div className="mb-3">
        <h5 className="text-info fw-bold mb-1">
          <i className="bi bi-arrow-left-right me-2" />
          Fund Realignments &amp; Term Carry-Over
        </h5>
        <p className="text-muted small mb-1">
          Close the active period, transfer verified net funds into the next General Fund,
          and activate the next term. Recorded student arrears remain outstanding.
        </p>
        <p className="text-muted small mb-0">
          Before closing a final term, choose the next school year&apos;s Full-Year, Semester, or
          Trimester calendar under <a href={`/department/${cleanDepartment}/setup`} className="text-info">System Setup → Academic Calendar</a>.
          Open periods require all pending remittances and cash custody to be reconciled.
        </p>
      </div>

      <RealignManager
        department={cleanDepartment}
        ay={ay}
        term={term}
        funds={sourceLedger.funds}
        totalRemaining={sourceLedger.totalRemaining}
        unliquidated={sourceLedger.unliquidated}
        cashierBalance={sourceLedger.cashierBalance}
        negativeFunds={sourceLedger.negativeFunds}
        nextPeriod={nextPeriod}
        sourceFeeCount={sourceFeeCount}
        destinationFeeCount={destFeeCount}
        destinationGeneralBalance={destinationBalance}
        activeRollover={sourceLedger.activeRollover}
      />
    </div>
  );
}
