import { prisma } from '@/lib/prisma';
import ReportsClient from './ReportsClient';
import { Metadata } from 'next';
import { getDepartmentFinancials } from '../../actions';

export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

export default async function InstitutionalReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{ ay?: string; term?: string }>;
}) {
  const { department } = await params;
  const cleanDepartment = decodeURIComponent(department).trim().toLowerCase();
  const resolvedSearch = searchParams ? await searchParams : {};
  const ay = resolvedSearch.ay || 'A.Y. 2026 - 2027';
  const term = resolvedSearch.term || '1st Sem';

const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment },
    select: { 
      id: true, 
      name: true, 
      logo: true,
      signatories: { orderBy: { order: 'asc' } } 
    }
  });

  if (!organization) {
    return <div className="alert alert-danger p-4">Department Not Found</div>;
  }

  // 1. Fetch Dynamic Package from Central Engine
  const financials = await getDepartmentFinancials(organization.id, ay, term);

  // 2. Fetch Master Student Roster & Setup Categories
  const [students, setups] = await Promise.all([
    prisma.student.findMany({
      where: { organizationId: organization.id },
      orderBy: { fullName: 'asc' }
    }),
    prisma.collectionSetup.findMany({
      where: { organizationId: organization.id, academicYear: ay, term }
    })
  ]);

  const setupCategories = Array.from(new Set(setups.map(s => s.name)));

  // 3. Fetch detailed financial records for the active term
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

  // BULLETPROOF SERIALIZATION
  const serialize = (data: any[]) => JSON.parse(JSON.stringify(data || []));

  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm">
      <ReportsClient 
        department={department}
        orgName={organization.name} // PASSED FULL DYNAMIC ORGANIZATION NAME
        ay={ay}
        term={term}
		orgId={organization.id}
        logoUrl={organization.logo}
        initialSignatories={organization.signatories || []}
        students={serialize(students)}
        collections={serialize(collections)}
        liquidations={serialize(liquidations)}
        penalties={serialize(penalties)}
        packageRate={financials.termPkg.total}
        setupCategories={setupCategories}
        termPkgItems={financials.termPkg.items}
      />
    </div>
  );
}