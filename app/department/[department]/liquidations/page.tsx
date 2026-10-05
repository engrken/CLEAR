import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import LiquidationsForm from './LiquidationsForm';
import { redirect } from 'next/navigation';

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
  // 1. EXTRACT PARAMS EARLY FOR REDIRECTION
  // =========================================================
  const { department } = await params;
  
  const cleanDepartment = decodeURIComponent(department).toLowerCase().trim();

  // =========================================================
  // 2. STRICT LOGIN & PERMISSION CHECK
  // =========================================================
  const session = await auth();

  // If not logged in, redirect to dashboard and trigger the LoginModal
  if (!session?.user) {
    redirect(`/department/${encodeURIComponent(cleanDepartment)}?login=true`);
  }

  // Check if user has the correct role for Liquidations (Audit)
  const userRole = session.user.role?.toLowerCase() || 'viewer';
  const allowedRoles = ['admin', 'administrator', 'master', 'auditor', 'audit'];

  // Decline access if they are a treasurer or viewer
  if (!allowedRoles.includes(userRole)) {
    redirect(`/department/${encodeURIComponent(cleanDepartment)}?forbidden=true`);
  }

  // =========================================================
  // 3. RESOLVE SEARCH PARAMS
  // =========================================================
  const resolvedSearch = searchParams ? await searchParams : {};

  const ay = resolvedSearch.ay || 'A.Y. 2026 - 2027';
  const term = resolvedSearch.term || '1st Sem';
  const prefillCaId = resolvedSearch.caId || '';

  // =========================================================
  // 4. FIND DEPARTMENT
  // =========================================================
  const organization = await prisma.organization.findUnique({
    where: {
      subdomain: cleanDepartment,
    },
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
  // 5. FETCH PENDING CASH ADVANCES AND FUNDS
  // =========================================================
  const [pendingAdvances, funds] = await Promise.all([
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
  ]);

  // =========================================================
  // 6. RENDER PAGE
  // =========================================================
  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm">
      <h5 className="text-accent mb-3">
        <i className="bi bi-receipt me-2"></i>
        Audit Liquidation Examination
      </h5>

      <LiquidationsForm
        department={cleanDepartment}
        ay={ay}
        term={term}
        pendingAdvances={pendingAdvances}
        funds={funds}
        prefillCaId={prefillCaId}
      />
    </div>
  );
}