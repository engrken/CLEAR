// /app/department/[department]/(protected)/summary/page.tsx


import { prisma } from '@/lib/prisma';
import SummaryClient from './SummaryClient';
import { Metadata } from 'next';
import { getDepartmentFinancials } from '../../actions';
import { requireTabAccess } from '@/lib/permissions';
import { summarizeCashOnlyPenaltyObligations } from '@/lib/summary-penalties';

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

  // Reporting-only aggregations. No student names, penalty reference IDs,
  // OR descriptions or individual collectible items are sent for display.
  // Only cash-only LATE_FEE obligations contribute to summary liabilities;
  // service-eligible penalties continue to affect clearance and penalty logs.
  const [feeSetups, receipts, activePenalties] = await Promise.all([
    prisma.collectionSetup.findMany({ where: { organizationId: organization.id, academicYear: ay, term },
      select: { category: true, name: true } }),
    prisma.collection.findMany({ where: { organizationId: organization.id, academicYear: ay, term },
      select: { studentId: true, studentName: true, category: true, itemDescription: true, amountPaid: true, status: true, paymentType: true } }),
    prisma.penalty.findMany({ where: { organizationId: organization.id, academicYear: ay, term, penaltyType: 'LATE_FEE' },
      select: { studentId: true, studentName: true, fineAmount: true, status: true, penaltyType: true } }),
  ]);
  const feeByItem = new Map<string, string>();
  const configuredCategories = new Set(feeSetups.map(s => s.category.trim().toLowerCase()));
  for (const setup of feeSetups) {
    const key = setup.name.trim().toLowerCase();
    // Ambiguous item names must not override a trusted receipt category.
    if (key && !feeByItem.has(key)) feeByItem.set(key, setup.category.trim());
  }
  type CategoryBucket = { category: string; students: Set<string>; totalCents: number };
  const byCategory = new Map<string, CategoryBucket>();
  for (const row of receipts) {
    if (/VOID|CANCEL/i.test(`${row.status || ''} ${row.paymentType || ''}`)) continue;
    const paidCents = Math.round(Number(row.amountPaid || 0) * 100);
    if (paidCents <= 0) continue; // due markers/assessments are not cash income
    const desc = String(row.itemDescription || '').trim();
    const receiptCategory = String(row.category || '').trim();
    let category = /^Penalty Fine(?:\s*\[|:)/i.test(desc) || /^Penalty(?:\s*\/\s*Fines)?$/i.test(receiptCategory)
      ? 'Penalty'
      : (configuredCategories.has(receiptCategory.toLowerCase())
        ? receiptCategory
        : feeByItem.get(desc.toLowerCase()) || receiptCategory || 'Other Collections');
    if (/^Departmental Fee Package/i.test(desc)) category = 'Departmental Fee';
    // Do not turn descriptive identifiers into visible category labels.
    if (/\[PEN-|^Penalty Fine/i.test(category)) category = 'Penalty';
    const current = byCategory.get(category) || { category, students: new Set<string>(), totalCents: 0 };
    const key = String(row.studentId || row.studentName || '').trim().toLowerCase();
    if (key) current.students.add(key);
    current.totalCents += paidCents;
    byCategory.set(category, current);
  }
  const summaryCategories = Array.from(byCategory.values())
    .map(row => ({ category: row.category, count: row.students.size, total: row.totalCents / 100 }))
    .sort((a, b) => a.category.localeCompare(b.category));

  const penaltySummary = summarizeCashOnlyPenaltyObligations(activePenalties);
  const duesSummary = {
    count: (financials.collectiblesList || []).reduce((sum: number, item: { headcount: number }) => sum + Number(item.headcount || 0), 0),
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
