import { prisma } from '@/lib/prisma';
import ReportsClient from './ReportsClient';
import { Metadata } from 'next';
import { getDepartmentFinancials } from '../../actions'; // Import the central engine

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
  const resolvedSearch = searchParams ? await searchParams : {};
  const ay = resolvedSearch.ay || 'A.Y. 2026 - 2027';
  const term = resolvedSearch.term || '1st Sem';

  const organization = await prisma.organization.findUnique({
    where: { subdomain: department },
  });

  if (!organization) {
    return <div className="alert alert-danger p-4">Department Not Found</div>;
  }

  // 1. Fetch Dynamic Package Total from Central Engine
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

  // Extract unique setup names to populate the Reports Category dropdown dynamically
  const setupCategories = Array.from(new Set(setups.map(s => s.name)));

  // 3. Fetch detailed financial records for the active term
  const [collections, liquidations, penalties] = await Promise.all([
    prisma.collection.findMany({
      where: { organizationId: organization.id, academicYear: ay, term },
      orderBy: { timestamp: 'desc' }
    }),
    // Fixed: Properly querying the 'audit' table instead of the legacy 'liquidation' hack
    prisma.audit.findMany({
      where: { organizationId: organization.id, academicYear: ay, term }
    }).catch(() => []),
    prisma.penalty.findMany({
      where: { organizationId: organization.id, academicYear: ay, term }
    })
  ]);

  // BULLETPROOF SERIALIZATION: Converts all Prisma Date objects to standard strings
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
        packageRate={financials.termPkg.total} // Pass the dynamic package rate
        setupCategories={setupCategories} // Pass the dynamic list of fees
      />
    </div>
  );
}