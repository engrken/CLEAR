import { prisma } from '@/lib/prisma';
import RemittanceVerificationQueue from './RemittanceVerificationQueue';

export default async function RemittancesPage({
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

  // Fetch online remittance submissions using correct schema field 'timestamp'[cite: 5]
  const rawRemittances = await prisma.onlineRemittance.findMany({
    where: { 
      organizationId: organization.id, 
      academicYear: ay, 
      term 
    },
    orderBy: { timestamp: 'desc' }
  });

  // Map and normalize Prisma results to satisfy non-null studentId property expectations
  const remittances = rawRemittances.map(r => ({
    ...r,
    studentId: r.studentId ?? '',
  }));

  // Get next sequential OR number for verification approval[cite: 5]
  const lastCollection = await prisma.collection.findFirst({
    where: { organizationId: organization.id, academicYear: ay },
    orderBy: { timestamp: 'desc' },
    select: { orNumber: true }
  });

  const yearPrefix = ay.match(/\d{4}/)?.[0]?.slice(-2) || '26';
  let nextOr = `${yearPrefix}-001`;

  if (lastCollection && lastCollection.orNumber) {
    const lastOr = lastCollection.orNumber.toUpperCase();
    if (!lastOr.includes('VOID') && !lastOr.includes('DUE-')) {
      const parts = lastOr.split('-');
      if (parts.length > 1) {
        const numPart = parseInt(parts[1].replace(/[^0-9]/g, ''), 10);
        if (!isNaN(numPart)) {
          const nextNum = numPart + 1;
          nextOr = `${parts[0]}-${nextNum < 1000 ? String(nextNum).padStart(3, '0') : nextNum}`;
        }
      }
    }
  }

  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm">
      <h5 className="text-accent mb-1"><i className="bi bi-wallet2 me-2"></i>Online Remittance Verification Queue</h5>
      <p className="text-secondary small mb-3">Inspect student GCash/Maya transaction screenshots, cross-verify references, and issue official receipts.</p>

      <RemittanceVerificationQueue 
        department={department}
        ay={ay}
        term={term}
        remittances={remittances}
        nextOr={nextOr}
      />
    </div>
  );
}