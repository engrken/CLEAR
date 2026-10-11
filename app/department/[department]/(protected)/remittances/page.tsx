// /(protected)/remittances/page.tsx

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import RemittanceVerificationQueue from './RemittanceVerificationQueue';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Online Remittance Verification | CLEAR',
};

export default async function RemittancesPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{ ay?: string; term?: string; }>;
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

  // BULLETPROOF SERIALIZATION
  const serialize = (data: any[]) => JSON.parse(JSON.stringify(data || []));

  // --- FETCH FUNDS FOR ALLOCATION DROPDOWN ---
  const funds = await prisma.fund.findMany({
    where: { organizationId: organization.id, academicYear: ay, term }
  });

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

  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm bg-body text-body">
      <div className="mb-4">
        <h5 className="text-info mb-1 fw-bold"><i className="bi bi-wallet2 me-2"></i>Online Remittance Verification</h5>
        <p className="text-muted small mb-0">Verify online student payments and issue Official Receipts.</p>
      </div>

      <RemittanceVerificationQueue 
        department={cleanDepartment}
        ay={ay}
        term={term}
        remittances={serialize(remittances)}
        nextOr={nextOr}
        funds={funds} 
      />
    </div>
  );
}