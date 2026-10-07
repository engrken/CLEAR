import { prisma } from '@/lib/prisma';
import CollectiblesManager from './CollectiblesManager';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

export default async function CollectiblesPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{ ay?: string; term?: string }>;
}) {
  const { department } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const ay = resolvedSearch.ay || 'A.Y. 2026 - 2027';
  const term = resolvedSearch.term || '1st Sem';

  const organization = await prisma.organization.findUnique({
    where: { subdomain: department },
  });

  if (!organization) {
    return (
      <div className="alert alert-danger p-4 shadow-sm border-secondary">
        <h4 className="fw-bold mb-2">Department Not Found</h4>
        <p className="small mb-0">The department '{decodeURIComponent(department)}' does not exist.</p>
      </div>
    );
  }

  const [students, collectibles, funds] = await Promise.all([
    prisma.student.findMany({
      where: { organizationId: organization.id },
      select: { studentId: true, fullName: true }
    }),
    prisma.collectible.findMany({
      where: { organizationId: organization.id, academicYear: ay, term },
      orderBy: { id: 'desc' }
    }),
    prisma.fund.findMany({
      where: { organizationId: organization.id, academicYear: ay, term }
    })
  ]);

  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm">
      <h5 className="text-accent mb-3"><i className="bi bi-inbox me-2"></i>Receivables & Collectibles Ledger</h5>
      <CollectiblesManager 
        department={department} 
        ay={ay} 
        term={term} 
        students={students} 
        collectibles={collectibles}
        funds={funds}
      />
    </div>
  );
}