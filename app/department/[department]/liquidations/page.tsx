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
  // STRICT LOGIN CHECK
  // =========================================================
  const session = await auth();

  if (!session?.user) {
    redirect('/department/${subdomain}');
  }

  // =========================================================
  // PARAMETERS
  // =========================================================
  const { department } = await params;

  const resolvedSearch = searchParams
    ? await searchParams
    : {};

  const ay =
    resolvedSearch.ay || 'A.Y. 2026 - 2027';

  const term =
    resolvedSearch.term || '1st Sem';

  const prefillCaId =
    resolvedSearch.caId || '';

  // =========================================================
  // FIND DEPARTMENT
  // =========================================================
  const cleanDepartment =
    decodeURIComponent(department)
      .toLowerCase()
      .trim();

  const organization =
    await prisma.organization.findUnique({
      where: {
        subdomain: cleanDepartment,
      },
    });

  if (!organization) {
    return (
      <div className="alert alert-danger p-4 shadow-sm border-secondary">
        <h4 className="fw-bold mb-2">
          Department Not Found
        </h4>

        <p className="small mb-0">
          The department '
          {decodeURIComponent(department)}
          ' does not exist.
        </p>
      </div>
    );
  }

  // =========================================================
  // FETCH PENDING CASH ADVANCES AND FUNDS
  // =========================================================
  const [pendingAdvances, funds] =
    await Promise.all([
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
  // PAGE
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