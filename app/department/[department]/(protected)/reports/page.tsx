import { prisma } from '@/lib/prisma';
import ReportsClient from './ReportsClient';
import { Metadata } from 'next';
import { getDepartmentFinancials } from '../../actions';

export const metadata: Metadata = {
  title: 'Institutional Reports & Audit Roster',
};

export default async function InstitutionalReportsPage({
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
    return <div className="alert alert-danger p-4">Department Not Found</div>;
  }

  // 1. Fetch Dynamic Collection Setups
  const collectionSetups = await prisma.collectionSetup.findMany({
    where: { organizationId: organization.id, academicYear: ay, term }
  });

  // 2. CRITICAL FIX: Only sum items where isPackage is NOT false
  const mandatorySetups = collectionSetups.filter(s => s.isPackage !== false);
  const calculatedPackageRate = mandatorySetups.length > 0
    ? mandatorySetups.reduce((sum, s) => sum + s.amount, 0)
    : 650.00;

  // 3. Fetch Master Financials & Roster
  const financials = await getDepartmentFinancials(organization.id, ay, term);
  const students = await prisma.student.findMany({
    where: { organizationId: organization.id },
    orderBy: { fullName: 'asc' }
  });

  const setupCategories = Array.from(new Set(collectionSetups.map(s => s.name)));
  
  const [collections, liquidations, penalties] = await Promise.all([
    prisma.collection.findMany({
      where: { organizationId: organization.id, academicYear: ay, term },
      orderBy: { timestamp: 'desc' }
    }),
    prisma.audit.findMany({
      where: { organizationId: organization.id, academicYear: ay, term }
    }).catch(() => []),
    prisma.penalty.findMany({
      where: { organizationId: organization.id, academicYear: ay, term }
    })
  ]);

  const serialize = (data: any[]) => JSON.parse(JSON.stringify(data || []));

  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm">
      <ReportsClient 
        department={department}
        ay={ay}
        term={term}
        students={serialize(students)}
        collections={serialize(collections)}
        liquidations={serialize(liquidations)}
        penalties={serialize(penalties)}
        packageRate={calculatedPackageRate}
        setupCategories={setupCategories}
      />
    </div>
  );
                                                                 }
