import { prisma } from '@/lib/prisma';
import RemittanceVerificationQueue from './RemittanceVerificationQueue';
import RemittanceManager from './RemittanceManager';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

export default async function RemittancesPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{ ay?: string; term?: string; subtab?: string }>;
}) {
  const { department } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const ay = resolvedSearch.ay || 'A.Y. 2026 - 2027';
  const term = resolvedSearch.term || '1st Sem';
  const subtab = resolvedSearch.subtab || 'queue'; // 'queue' or 'manager'

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

  // BULLETPROOF SERIALIZATION: Prevents Next.js Date object passing errors
  const serialize = (data: any[]) => JSON.parse(JSON.stringify(data || []));

  // --- DATA FOR VERIFICATION QUEUE ---
  const rawRemittances = await prisma.onlineRemittance.findMany({
    where: { organizationId: organization.id, academicYear: ay, term },
    orderBy: { timestamp: 'desc' }
  });

  const remittances = rawRemittances.map(r => ({
    ...r,
    studentId: r.studentId ?? '',
  }));

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

  // --- DATA FOR REMITTANCE MANAGER ---
  const allCollections = await prisma.collection.findMany({
    where: { organizationId: organization.id, academicYear: ay, term },
    orderBy: { timestamp: 'desc' }
  });

  const unremittedItems = allCollections.filter(c => c.status === 'Valid');
  const remittedItems = allCollections.filter(c => c.status && c.status.startsWith('Remitted'));

  // Base path for sub-tab navigation
  const cleanSubdomain = decodeURIComponent(department).toLowerCase().trim();
  const basePath = `/department/${encodeURIComponent(cleanSubdomain)}/remittances`;
  const queryString = `?ay=${encodeURIComponent(ay)}&term=${encodeURIComponent(term)}`;

  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h5 className="text-accent mb-1"><i className="bi bi-wallet2 me-2"></i>Remittance & Verification</h5>
          <p className="text-secondary small mb-0">Verify online student payments or submit physical cash batches to the treasury.</p>
        </div>

        {/* SUB-TAB NAVIGATION */}
        <div className="btn-group btn-group-sm" role="group">
          <Link
            href={`${basePath}${queryString}&subtab=queue`}
            className={`btn ${subtab === "queue" ? "btn-outline-info active fw-bold" : "btn-outline-secondary"}`}
          >
            <i className="bi bi-list-check me-1"></i> Verification Queue
          </Link>
          <Link
            href={`${basePath}${queryString}&subtab=manager`}
            className={`btn ${subtab === "manager" ? "btn-outline-success active fw-bold" : "btn-outline-secondary"}`}
          >
            <i className="bi bi-bank me-1"></i> Treasury Remittance
          </Link>
        </div>
      </div>

      <hr className="border-secondary mt-0 mb-4" />

      {/* RENDER ACTIVE SUB-TAB */}
      {subtab === 'queue' ? (
        <RemittanceVerificationQueue 
          department={department}
          ay={ay}
          term={term}
          remittances={serialize(remittances)}
          nextOr={nextOr}
        />
      ) : (
        <RemittanceManager 
          department={department}
          ay={ay}
          term={term}
          unremittedItems={serialize(unremittedItems)}
          remittedItems={serialize(remittedItems)}
        />
      )}
    </div>
  );
}