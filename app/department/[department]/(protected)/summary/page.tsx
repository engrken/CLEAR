// /app/department/[department]/(protected)/summary/page.tsx

import { prisma } from '@/lib/prisma';
import SummaryClient from './SummaryClient';
import { Metadata } from 'next';
import { getDepartmentFinancials } from '../../actions';
import { redirect } from 'next/navigation';
import { requireTabAccess } from '@/lib/permissions';

export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

export default async function SummaryReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{ ay?: string; term?: string }>;
}) {
  const { department } = await params;
  const cleanDepartment = decodeURIComponent(department).trim().toLowerCase();

  try {
    await requireTabAccess('tab-report', cleanDepartment);
  } catch {
    redirect(`/department/${encodeURIComponent(cleanDepartment)}?forbidden=true`);
  }

  const resolvedSearch = searchParams ? await searchParams : {};
  const ay = resolvedSearch.ay || 'A.Y. 2026 - 2027';
  const term = resolvedSearch.term || '1st Sem';

  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment },
    select: { 
      id: true, 
      name: true, 
      logo: true,
      signatories: {
        orderBy: { order: 'asc' }
      } 
    }
  });

  if (!organization) {
    return <div className="alert alert-danger p-4">Department Not Found</div>;
  }

  // Fetch all calculations from the centralized dynamic engine
  const financials = await getDepartmentFinancials(organization.id, ay, term);

  return (
    <div className="mx-auto" style={{ maxWidth: '1150px', minWidth: 0 }}>
      <SummaryClient 
        department={department}
        orgId={organization.id}
        orgName={organization.name}
        logoUrl={organization.logo}
        initialSignatories={organization.signatories || []}
        ay={ay}
        term={term}
        termPkg={financials.termPkg}
        collectionHierarchy={financials.collectionHierarchy}
        grandCollectionTotal={financials.grandCollectionTotal}
        expensesByFund={financials.expensesByFund}
        grandExpenseTotal={financials.grandExpenseTotal}
        collectibles={financials.collectiblesList}
        totalCollectiblesSum={financials.totalCollectibles}
        cashierBalance={financials.cashierBalance}
        totalDeposited={financials.totalDeposited}
        totalWithdrawn={financials.totalWithdrawn}
        remainingBalance={financials.remainingBalance}
      />
    </div>
  );
}