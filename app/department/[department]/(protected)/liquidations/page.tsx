// @ts-nocheck
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import LiquidationsClient from './LiquidationsClient';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

export default async function LiquidationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{
    ay?: string;
    term?: string;
    caId?: string;
  }>;
}) {
  // =========================================================
  // 1. EXTRACT PARAMS
  // =========================================================
  const { department } = await params;

  const cleanDepartment = decodeURIComponent(department)
    .trim()
    .toLowerCase();

  // =========================================================
  // 2. AUTHENTICATION
  // =========================================================
  const session = await auth();

  if (!session?.user) {
    redirect(
      `/department/${encodeURIComponent(cleanDepartment)}?login=true`
    );
  }

  // =========================================================
  // 3. SUPERADMIN / ROLE AUTHORIZATION
  // =========================================================
  const userWithRole = session.user as typeof session.user & {
    role?: string | null;
  };

  const userRole = String(userWithRole.role ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

  const userEmail = String(userWithRole.email ?? '')
    .trim()
    .toLowerCase();

  const isSuperAdmin =
    userRole === 'superadmin' ||
    userRole === 'master' ||
    userEmail === 'kent.bsece@gmail.com';

  const allowedRoles = [
    'admin',
    'administrator',
    'auditor',
    'audit',
  ];

  if (!isSuperAdmin && !allowedRoles.includes(userRole)) {
    redirect(
      `/department/${encodeURIComponent(cleanDepartment)}?forbidden=true`
    );
  }

  // =========================================================
  // 4. RESOLVE SEARCH PARAMS
  // =========================================================
  const resolvedSearch = searchParams ? await searchParams : {};

  const ay = resolvedSearch.ay || 'A.Y. 2026 - 2027';
  const term = resolvedSearch.term || '1st Sem';
  const prefillCaId = resolvedSearch.caId || '';

  // =========================================================
  // 5. FIND DEPARTMENT & SIGNATORIES
  // =========================================================
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
    return (
      <div className="alert alert-danger p-4 shadow-sm border-secondary">
        <h4 className="fw-bold mb-2">Department Not Found</h4>
        <p className="small mb-0">
          The department '{decodeURIComponent(department)}' does not exist.
        </p>
      </div>
    );
  }

  // =========================================================
  // 6. FETCH ADVANCES, FUNDS, AND PAST AUDITS
  // =========================================================
  const [pendingAdvances, funds, pastAudits] = await Promise.all([
    prisma.cashAdvance.findMany({
      where: {
        organizationId: organization.id,
        academicYear: ay,
        term,
        status: {
          contains: 'Pending',
        },
      },
      orderBy: {
        dateIssued: 'desc',
      },
    }),

    prisma.fund.findMany({
      where: {
        organizationId: organization.id,
        academicYear: ay,
        term,
      },
    }),

    // Fetch the historical liquidations for the History Tab
    prisma.liquidation.findMany({
      where: {
        organizationId: organization.id,
        academicYear: ay,
        term,
      },
      include: {
        items: true,
      },
      orderBy: {
        date: 'desc',
      },
    }).catch(() => []), // Fallback to empty array if not ready
  ]);

  // =========================================================
  // 7. RENDER PAGE
  // =========================================================
  return (
    <div className="module card p-0 border-secondary shadow-sm overflow-hidden bg-body">
      <LiquidationsClient
        department={cleanDepartment}
        orgName={organization.name}
        logoUrl={organization.logo}
        signatories={organization.signatories || []}
        ay={ay}
        term={term}
        pendingAdvances={pendingAdvances}
        funds={funds}
        prefillCaId={prefillCaId}
        pastAudits={pastAudits}
      />
    </div>
  );
}