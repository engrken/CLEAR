// app/department/[department]/(protected)/liquidations/page.tsx

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import LiquidationsClient from './LiquidationsClient';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { requireTabAccess } from '@/lib/permissions';
import { getPeriodLedger } from '../realign/ledger';

export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

export default async function LiquidationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{
    ay?: string;
    term?: string;
    caId?: string;
  }>;
}) {
  // 1. Extract and normalize the department slug.
  const { department } = await params;
  const cleanDepartment = decodeURIComponent(department).trim().toLowerCase();

  // 2. Authentication and permission check.
  const session = await auth();

  if (!session?.user) {
    redirect(`/department/${encodeURIComponent(cleanDepartment)}?login=true`);
  }

  try {
    await requireTabAccess('tab-audit', cleanDepartment);
  } catch {
    redirect(`/department/${encodeURIComponent(cleanDepartment)}?forbidden=true`);
  }

  // 3. Resolve requested academic year, term, and optional cash-advance prefill.
  const resolvedSearch = searchParams ? await searchParams : {};
  const prefillCaId = resolvedSearch.caId || '';

  // 4. Load the department and all existing report branding settings.
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
      <div className="alert alert-danger p-4 shadow-sm border-secondary">
        <h4 className="fw-bold mb-2">Department Not Found</h4>
        <p className="small mb-0">
          The department '{decodeURIComponent(department)}' does not exist.
        </p>
      </div>
    );
  }

  const ay = resolvedSearch.ay || organization.activeAy || 'A.Y. 2026 - 2027';
  const term = resolvedSearch.term || organization.activeTerm || '1st Sem';

  // 5. Fetch cash advances, funds, historical liquidations, and the period status.
  let canVoid = false;
  try { await requireTabAccess("tab-void", cleanDepartment); canVoid = true; } catch { /* no void rights */ }
  const [allAdvances, funds, rawPastAudits, periodLedger] = await Promise.all([
    prisma.cashAdvance.findMany({
      where: {
        organizationId: organization.id,
        academicYear: ay,
        term,
      },
      orderBy: { dateIssued: 'desc' },
    }),
    prisma.fund.findMany({
      where: {
        organizationId: organization.id,
        academicYear: ay,
        term,
      },
    }),
    prisma.audit.findMany({
        where: {
          organizationId: organization.id,
          academicYear: ay,
          term,
        },
        include: { expenseItems: true },
        orderBy: { date: 'desc' },
      }),
    getPeriodLedger(prisma, organization.id, ay, term),
  ]);

  // Prisma Decimal fields must be normalized before crossing the server/client boundary.
  // In particular, the form uses toFixed() after selecting an advance.
  const pendingAdvances = allAdvances.filter(advance => {
    const status = String(advance.status || '').toUpperCase();
    return !/VOID|CANCEL/.test(status) && !status.includes('LIQUIDATED') &&
      (status.includes('PENDING') || status.includes('UNLIQUIDATED') || status === 'ACTIVE');
  }).map(advance => ({
    id: advance.id,
    advanceId: advance.advanceId,
    requestor: advance.requestor,
    fundSource: advance.fundSource,
    amountApproved: Number(advance.amountApproved),
  }));

  // LiquidationHistory expects each audit's line items in `items`.
  const pastAudits = rawPastAudits.map((audit: any) => ({
    ...audit,
    items: audit.expenseItems,
  }));

  // 6. Send branding settings through to LiquidationsClient.
  // LiquidationsClient must forward these props to its LiquidationHistory child.
  return (
    <div className="module card p-0 border-secondary shadow-sm overflow-hidden bg-body text-body">
      <LiquidationsClient
        orgId={organization.id}
        department={cleanDepartment}
        orgName={organization.name}
        logoUrl={organization.logo}
        reportSchoolName={organization.reportSchoolName ?? ''}
        reportSchoolAddress={organization.reportSchoolAddress ?? ''}
        reportHeaderLeftLogo={organization.reportHeaderLeftLogo ?? ''}
        reportHeaderRightLogo={organization.reportHeaderRightLogo ?? ''}
        signatories={organization.signatories || []}
        ay={ay}
        term={term}
        pendingAdvances={pendingAdvances}
        funds={funds}
        prefillCaId={prefillCaId}
        pastAudits={pastAudits}
        isClosed={Boolean(periodLedger.activeRollover)}
        canVoid={canVoid}
      />
    </div>
  );
}
