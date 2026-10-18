// /app/department/[department]/(protected)/setup/page.tsx



import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  requireTabAccess,
  isSuperAdminEmail,
} from "@/lib/permissions";
import SetupClient from "./SetupClient";
import { PENALTY_FUND_NAME } from "@/lib/penalty-fund";
import RestoreForm from "./RestoreForm";
import { Metadata } from "next";
import { inspectFundUsage } from "./fund-policy";
import AcademicPeriodSettings from "./AcademicPeriodSettings";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Centralized Liquidation of Expenses & Audit Records",
};

export const dynamic = "force-dynamic";

export default async function SetupPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department } = await params;

  let cleanDepartment: string;

  try {
    cleanDepartment = decodeURIComponent(department)
      .trim()
      .toLowerCase();
  } catch {
    return (
      <div className="alert alert-danger p-4">
        Invalid department identifier.
      </div>
    );
  }

  await requireTabAccess("tab-setup", cleanDepartment);

  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment },
  });

  if (!organization) {
    return (
      <div className="alert alert-danger p-4 shadow-sm border-secondary">
        <h4 className="fw-bold mb-2">Department Not Found</h4>
        <p className="small mb-0">
          The department &apos;{cleanDepartment}&apos; does not exist.
        </p>
      </div>
    );
  }

  const session = await auth();
  const sessionEmail = String(session?.user?.email || "")
    .trim()
    .toLowerCase();

  let canManageBackups = false;

  if (sessionEmail) {
    if (isSuperAdminEmail(sessionEmail)) {
      canManageBackups = true;
    } else {
      const dbUser = await prisma.tenantUser.findFirst({
        where: {
          organizationId: organization.id,
          email: {
            equals: sessionEmail,
            mode: "insensitive",
          },
        },
        select: {
          role: true,
          status: true,
        },
      });

      const normalizedRole = String(dbUser?.role || "")
        .trim()
        .toLowerCase();

      canManageBackups =
        dbUser?.status === "Active" &&
        ["admin", "administrator", "master"].includes(
          normalizedRole
        );
    }
  }

  const [
    existingFunds,
    academicCalendars,
    rolloverTransfers,
    rolloverReversals,
  ] = await Promise.all([
    prisma.fund.findMany({
      where: { organizationId: organization.id },
      select: { id: true, fundName: true, initialAllocation: true, academicYear: true, term: true },
    }),
    prisma.academicPeriodConfig.findMany({
      where: { organizationId: organization.id },
      select: { academicYear: true, mode: true, includeSummer: true },
    }),

    prisma.fundTransfer.findMany({
      where: {
        organizationId: organization.id,
        sourceFund: {
          contains: "Rollover",
          mode: "insensitive",
        },
      },
      orderBy: { timestamp: "desc" },
    }),

    prisma.voidTransaction.findMany({
      where: {
        organizationId: organization.id,
        transactionType: "ROLLOVER_REVERSAL",
      },
      select: {
        referenceId: true,
        reason: true,
        voidedBy: true,
        date: true,
      },
      orderBy: { date: "desc" },
    }),
  ]);

  // Keep the saved amounts for each period so selecting a year/term never silently resets
  // its existing allocations to zero.
  const allocationsByPeriod: Record<string, { id?: string; fundName: string; amount: number }[]> = {};
  for (const fund of existingFunds) {
    const key = `${fund.academicYear}|${fund.term}`;
    (allocationsByPeriod[key] ||= []).push({
      id: fund.id,
      fundName: fund.fundName,
      amount: Number(fund.initialAllocation) || 0,
    });
  }
  const hasInitialCalendar = academicCalendars.some(x => x.academicYear === organization.activeAy);
  const hasUsableFund = existingFunds.some(x =>
    x.academicYear === organization.activeAy &&
    x.term === organization.activeTerm &&
    x.fundName.toLowerCase() !== PENALTY_FUND_NAME.toLowerCase()
  );
  const configuredFeeCount = await prisma.collectionSetup.count({
    where: { organizationId: organization.id, academicYear: organization.activeAy, term: organization.activeTerm },
  });
  const setupComplete = hasInitialCalendar && hasUsableFund && configuredFeeCount > 0;
  const firstFeeUrl = `/department/${encodeURIComponent(cleanDepartment)}/setup/collections?ay=${encodeURIComponent(organization.activeAy)}&term=${encodeURIComponent(organization.activeTerm)}`;

  const usage = await inspectFundUsage(prisma, organization.id, existingFunds);
  const fundLockReasonsByPeriod: Record<string, Record<string,string>> = {};
  for (const fund of existingFunds) {
    const periodKey = `${fund.academicYear}|${fund.term}`;
    const reason = usage.referenced.get(usage.refKey(fund.academicYear, fund.term, fund.fundName)) ||
      (fund.fundName.toLowerCase() === PENALTY_FUND_NAME.toLowerCase() ? "System Penalty Fund" : "");
    if (reason) (fundLockReasonsByPeriod[periodKey] ||= {})[fund.id] = reason;
  }

  const initialFunds = Array.from(new Set([
    ...(existingFunds.length > 0
      ? existingFunds.map((fund) => fund.fundName)
      : ["General Fund", "Current Operations", "Others"]),
    PENALTY_FUND_NAME,
  ])).sort();

  // The newest reversal is used if any older data contains duplicates.
  const reversalByTransferId = new Map<
    string,
    (typeof rolloverReversals)[number]
  >();

  for (const reversal of rolloverReversals) {
    if (!reversalByTransferId.has(reversal.referenceId)) {
      reversalByTransferId.set(reversal.referenceId, reversal);
    }
  }

  const initialRolloverLogs = rolloverTransfers.map((transfer) => {
    const reversal = reversalByTransferId.get(transfer.id);

    return {
      id: transfer.id,
      reference: `RO-${transfer.id.slice(0, 8).toUpperCase()}`,
      sourcePeriod: String(transfer.sourceFund || "")
        .replace(/\s+Rollover\s*$/i, "")
        .trim(),
      destPeriod: `${transfer.term} (${transfer.academicYear})`,
      amount: Number(transfer.amount) || 0,
      date: transfer.timestamp.toISOString().slice(0, 10),
      status: reversal ? "Reversed / Voided" : "Active",
      encodedBy: transfer.encodedBy || "System",
      reversalReason: reversal?.reason ?? null,
      reversedBy: reversal?.voidedBy ?? null,
      reversedAt:
        reversal?.date.toISOString().slice(0, 10) ?? null,
    };
  });

  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm">
      {!setupComplete && <section className="card border-info p-3 mb-4 bg-body text-body" aria-label="First-time tenant setup">
        <h5 className="text-info fw-bold mb-2"><i className="bi bi-list-check me-2" />First-Time Tenant Setup</h5>
        <p className="small text-body-secondary mb-3">Complete these steps before recording student charges or payments in the new academic period. This checklist is guidance; existing financial protections remain enforced by each module.</p>
        <ol className="small mb-3 ps-3">
          <li className="mb-2"><strong>{hasInitialCalendar ? '✓' : '1.'} Academic calendar:</strong> {hasInitialCalendar ? `Configured for ${organization.activeAy}.` : 'Choose and save the school year and period system below.'}</li>
          <li className="mb-2"><strong>{hasUsableFund ? '✓' : '2.'} Fund pools:</strong> {hasUsableFund ? 'A destination fund is available for the active period.' : 'Scroll to Organization Setup and save at least one non-Penalty fund such as General Fund.'}</li>
          <li><strong>{configuredFeeCount > 0 ? '✓' : '3.'} Collection fees:</strong> {configuredFeeCount > 0 ? `${configuredFeeCount} fee(s) configured for ${organization.activeTerm}.` : 'Add collection items, amounts, categories, package requirements and fund allocations.'}</li>
        </ol>
        <div className="d-flex flex-wrap gap-2">
          <a className="btn btn-outline-info btn-sm fw-semibold" href="#fund-setup">Configure Fund Pools</a>
          <Link className="btn btn-info btn-sm fw-semibold text-dark" href={firstFeeUrl}>Setup Collection Fees <i className="bi bi-arrow-right ms-1" /></Link>
        </div>
      </section>}
      <AcademicPeriodSettings
        department={cleanDepartment}
        activeAy={organization.activeAy}
        initialConfigs={Object.fromEntries(academicCalendars.map(x => [x.academicYear, {
          mode: x.mode as "Semester" | "Trimester" | "FullYear",
          includeSummer: x.includeSummer,
        }]))}
      />
      <div id="fund-setup" />
      <SetupClient
        department={cleanDepartment}
        organizationId={organization.id}
        initialFundNames={initialFunds}
        currentLogo={organization.logo}
        activeAy={organization.activeAy}
        activeTerm={organization.activeTerm}
        calendarConfigs={Object.fromEntries(academicCalendars.map(x => [x.academicYear, {
          mode: x.mode as "Semester" | "Trimester" | "FullYear",
          includeSummer: x.includeSummer,
        }]))}
        initialRolloverLogs={initialRolloverLogs}
        allocationsByPeriod={allocationsByPeriod}
        closedPeriods={Array.from(usage.closedPeriods)}
        financialPeriods={Array.from(usage.periodsWithActivity)}
        fundLockReasonsByPeriod={fundLockReasonsByPeriod}
      />

      {canManageBackups && (
        <>
          <div className="card p-3 border-info bg-info bg-opacity-10 shadow-sm mt-4 text-body">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
              <div>
                <h6 className="fw-bold text-info mb-1">
                  <i className="bi bi-cloud-arrow-down-fill me-2" />
                  Database Backup &amp; Export
                </h6>
                <small className="text-muted">
                  Download an encrypted, authenticated backup of this department&apos;s
                  records. Restricted to active administrators.
                </small>
              </div>

              <a
                href={`/api/backup?orgId=${encodeURIComponent(organization.id)}`}
                className="btn btn-info fw-bold text-dark d-flex align-items-center gap-2"
                download
              >
                <i className="bi bi-download" />
                Export Encrypted Backup
              </a>
            </div>
          </div>

          <RestoreForm organizationId={organization.id} />
        </>
      )}
    </div>
  );
}
