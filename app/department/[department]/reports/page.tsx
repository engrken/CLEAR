import { prisma } from '@/lib/prisma';
import ReportsClient from './ReportsClient';

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

  // 1. Fetch Master Student Roster
  const students = await prisma.student.findMany({
    where: { organizationId: organization.id },
    orderBy: { fullName: 'asc' }
  });

  // 2. Fetch all financial records for the active term
  const [collections, liquidations, penalties] = await Promise.all([
    prisma.collection.findMany({
      where: { organizationId: organization.id, academicYear: ay, term },
      orderBy: { timestamp: 'desc' }
    }),
    // Safe fallback for liquidations to prevent Prisma runtime crashes
    (prisma as any).liquidation ? (prisma as any).liquidation.findMany({
      where: { organizationId: organization.id, academicYear: ay, term }
    }) : Promise.resolve([]),
    prisma.penalty.findMany({
      where: { organizationId: organization.id, academicYear: ay, term }
    })
  ]);

  // BULLETPROOF SERIALIZATION: Converts all Prisma Date objects to standard strings
  // This prevents the Next.js "Only plain objects can be passed to Client Components" error.
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
      />
    </div>
  );
}