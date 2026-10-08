import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import LiquidationsForm from './LiquidationsForm';
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

  /**
   * Extend the NextAuth user object with the custom role field.
   */
  const userWithRole = session.user as typeof session.user & {
    role?: string | null;
  };

  /**
   * Normalize role and email so that:
   *
   * "SuperAdmin"
   * "SUPER_ADMIN"
   * "super-admin"
   * " superadmin "
   *
   * can all be handled consistently.
   */
  const userRole = String(userWithRole.role ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

  const userEmail = String(userWithRole.email ?? '')
    .trim()
    .toLowerCase();

  /**
   * SUPERADMIN BYPASS
   *
   * This must happen BEFORE the normal role restriction.
   */
  const isSuperAdmin =
    userRole === 'superadmin' ||
    userRole === 'master' ||
    userEmail === 'kent.bsece@gmail.com';

  /**
   * Roles permitted to access Liquidations.
   *
   * Superadmin is already handled above.
   */
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
  // 5. FIND DEPARTMENT
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
  // 6. FETCH PENDING CASH ADVANCES AND FUNDS
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
  // 7. RENDER PAGE
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