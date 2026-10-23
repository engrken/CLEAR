// /app/department/[department]/(protected)/summary/page.tsx


import { moneyNumber } from "@/lib/money-precision";
import { prisma } from '@/lib/prisma';
import SummaryClient from './SummaryClient';
import { Metadata } from 'next';
import { getDepartmentFinancials } from '../../actions';
import { requireTabAccess } from '@/lib/permissions';
import { summarizeCashOnlyPenaltyObligations } from '@/lib/summary-penalties';
import { itemizeCollectionsForSummary } from '@/lib/summary-collections';

export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

export const dynamic = 'force-dynamic';

export default async function SummaryReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{ ay?: string; term?: string }>;
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

  await requireTabAccess('tab-report', cleanDepartment);

  const resolvedSearch = searchParams ? await searchParams : {};

  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment },
    select: {
      id: true,
      name: true,
      logo: true,
      activeAy: true,
      activeTerm: true,

      reportSchoolName: true,
      reportSchoolAddress: true,
      reportHeaderLeftLogo: true,
      reportHeaderRightLogo: true,

      signatories: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!organization) {
    return (
      <div className="alert alert-danger p-4">
        Department Not Found
      </div>
    );
  }

  const ay =
    (typeof resolvedSearch.ay === 'string'
      ? resolvedSearch.ay.trim()
      : '') ||
    organization.activeAy ||
    'A.Y. 2026 - 2027';

  const term =
    (typeof resolvedSearch.term === 'string'
      ? resolvedSearch.term.trim()
      : '') ||
    organization.activeTerm ||
    '1st Sem';

  const financials = await getDepartmentFinancials(
    organization.id,
    ay,
    term
  );

  // Reporting-only aggregations. Receipt descriptions are summarized by
  // collection item. No student names, student IDs or OR identifiers are sent
  // to the client, and the category headings carry no subtotal amount.
  // Only cash-only LATE_FEE obligations contribute to summary liabilities;
  // service-eligible penalties continue to affect clearance and penalty logs.
  const [feeSetups, receipts, activePenalties] = await Promise.all([
    prisma.collectionSetup.findMany({ where: { organizationId: organization.id, academicYear: ay, term },
      select: { category: true, name: true, amount: true, isPackage: true } }),
    prisma.collection.findMany({ where: { organizationId: organization.id, academicYear: ay, term },
      select: { studentId: true, studentName: true, category: true, itemDescription: true, amountPaid: true, status: true, paymentType: true } }),
    prisma.penalty.findMany({ where: { organizationId: organization.id, academicYear: ay, term, penaltyType: 'LATE_FEE' },
      select: { studentId: true, studentName: true, fineAmount: true, status: true, penaltyType: true } }),
  ]);
  // This breakdown uses actual valid paid receipts; package-only receipts are
  // apportioned across configured package items, preserving exact centavos.
  // Do not use this to recalculate or alter the authoritative finance engine.
  const summaryCategories = itemizeCollectionsForSummary(receipts.map(row => ({ ...row, amountPaid: moneyNumber(row.amountPaid) })), feeSetups.map(row => ({ ...row, amount: moneyNumber(row.amount) })));

  const penaltySummary = summarizeCashOnlyPenaltyObligations(activePenalties.map(row => ({ ...row, fineAmount: moneyNumber(row.fineAmount) })));
  // Reuse the finance engine's authoritative collectible buckets. Do not
  // re-query/recalculate individual obligations or expose student identifiers.
  // These rows always reconcile to the Dues / Collectibles summary above.
  const duesBreakdown = (financials.collectiblesList || [])
    .map((item: { category: string; headcount: number; total: number }) => ({
      category: String(item.category || '').trim() || 'Unassigned',
      count: Number(item.headcount || 0),
      amount: Number(item.total || 0),
    }))
    // A zero-balance category is not an outstanding obligation, even if its
    // original assessment count is nonzero. Preserve nonzero discrepancies.
    .filter((item) => Number.isFinite(item.amount) && Math.round(item.amount * 100) !== 0)
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));

  const duesSummary = {
    count: duesBreakdown.reduce((sum, item) => sum + item.count, 0),
    amount: Number(financials.totalCollectibles || 0),
  };

  return (
    <div className="mx-auto" style={{ maxWidth: '1150px', minWidth: 0 }}>
      <SummaryClient
        department={cleanDepartment}
        orgId={organization.id}
        orgName={organization.name}
        logoUrl={organization.logo}

        reportSchoolName={organization.reportSchoolName}
        reportSchoolAddress={organization.reportSchoolAddress}
        reportHeaderLeftLogo={organization.reportHeaderLeftLogo}
        reportHeaderRightLogo={organization.reportHeaderRightLogo}

        initialSignatories={organization.signatories || []}
        ay={ay}
        term={term}
        summaryCategories={summaryCategories}
        penaltySummary={penaltySummary}
        duesSummary={duesSummary}
        duesBreakdown={duesBreakdown}
        grandCollectionTotal={financials.grandCollectionTotal}
        expensesByFund={financials.expensesByFund}
        grandExpenseTotal={financials.grandExpenseTotal}
        cashierBalance={financials.cashierBalance}
        totalDeposited={financials.totalDeposited}
        totalWithdrawn={financials.totalWithdrawn}
        remainingBalance={financials.remainingBalance}
        carryOverInboundTotal={financials.carryOverInboundTotal}
        carryOverOutboundTotal={financials.carryOverOutboundTotal}
      />
    </div>
  );
}
