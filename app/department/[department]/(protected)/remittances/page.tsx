// /(protected)/remittances/page.tsx

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import RemittanceVerificationQueue from './RemittanceVerificationQueue';
import RemittanceManager from './RemittanceManager';
import Link from 'next/link';
import { redirect } from 'next/navigation';
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
  // =========================================================
  // 1. EXTRACT PARAMS & AUTHENTICATION
  // =========================================================
  const { department } = await params;
  const cleanDepartment = decodeURIComponent(department).toLowerCase().trim();

  const session = await auth();
  if (!session?.user) {
    redirect(`/department/${encodeURIComponent(cleanDepartment)}?login=true`);
  }

  // =========================================================
  // 2. AUTHORIZATION
  // =========================================================
  const userWithRole = session.user as typeof session.user & { role?: string | null; };
  const userRole = String(userWithRole.role ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  const userEmail = String(userWithRole.email ?? '').trim().toLowerCase();

  const isSuperAdmin = userRole === 'superadmin' || userRole === 'master' || userEmail === 'kent.bsece@gmail.com';
  const allowedRoles = ['admin', 'administrator', 'auditor', 'audit', 'treasurer'];

  if (!isSuperAdmin && !allowedRoles.includes(userRole)) {
    redirect(`/department/${encodeURIComponent(cleanDepartment)}?forbidden=true`);
  }

  // =========================================================
  // 3. RESOLVE SEARCH PARAMS & DB FETCH
  // =========================================================
  const resolvedSearch = searchParams ? await searchParams : {};
  const ay = resolvedSearch.ay || 'A.Y. 2026 - 2027';
  const term = resolvedSearch.term || '1st Sem';
  const subtab = resolvedSearch.subtab || 'queue'; // 'queue' or 'manager'

  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment },
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

  // --- FETCH FUNDS FOR ALLOCATION DROPDOWN ---
  const funds = await prisma.fund.findMany({
    where: { organizationId: organization.id, academicYear: ay, term }
  });

  // --- DATA FOR REMITTANCE MANAGER ---
  const allCollections = await prisma.collection.findMany({
    where: { organizationId: organization.id, academicYear: ay, term },
    orderBy: { timestamp: 'desc' }
  });

  // Mapped to ensure studentId is always a string for strict TypeScript
  const safeCollections = allCollections.map(c => ({
    ...c,
    studentId: c.studentId ?? ''
  }));

  const unremittedItems = safeCollections.filter(c => c.status === 'Valid');
  const remittedItems = safeCollections.filter(c => c.status && c.status.startsWith('Remitted'));

  const basePath = `/department/${encodeURIComponent(cleanDepartment)}/remittances`;
  const queryString = `?ay=${encodeURIComponent(ay)}&term=${encodeURIComponent(term)}`;

  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm bg-body text-body">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h5 className="text-info mb-1 fw-bold"><i className="bi bi-wallet2 me-2"></i>Remittance & Verification</h5>
          <p className="text-muted small mb-0">Verify online student payments or submit physical cash batches to the treasury.</p>
        </div>

        <div className="btn-group btn-group-sm" role="group">
          <Link
            href={`${basePath}${queryString}&subtab=queue`}
            className={`btn ${subtab === "queue" ? "btn-info text-dark fw-bold" : "btn-outline-secondary"}`}
          >
            <i className="bi bi-list-check me-1"></i> Verification Queue
          </Link>
          <Link
            href={`${basePath}${queryString}&subtab=manager`}
            className={`btn ${subtab === "manager" ? "btn-success text-dark fw-bold" : "btn-outline-secondary"}`}
          >
            <i className="bi bi-bank me-1"></i> Treasury Remittance
          </Link>
        </div>
      </div>

      <hr className="border-secondary mt-0 mb-4" />

      {subtab === 'queue' ? (
        <RemittanceVerificationQueue 
          department={cleanDepartment}
          ay={ay}
          term={term}
          remittances={serialize(remittances)}
          nextOr={nextOr}
          funds={funds} // <--- PASS FUNDS TO COMPONENT
        />
      ) : (
        <RemittanceManager 
          department={cleanDepartment}
          ay={ay}
          term={term}
          unremittedItems={serialize(unremittedItems)}
          remittedItems={serialize(remittedItems)}
        />
      )}
    </div>
  );
}