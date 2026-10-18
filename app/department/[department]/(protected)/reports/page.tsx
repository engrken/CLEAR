// app/department/[department]/(protected)/reports/page.tsx

import { prisma } from '@/lib/prisma';
import { requireTabAccess } from '@/lib/permissions';
import ReportsClient from './ReportsClient';
import { Metadata } from 'next';
import { getDepartmentFinancials } from '../../actions';

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
  const cleanDepartment = decodeURIComponent(department).trim().toLowerCase();

  // Enforce tab-level permissions for this department.
  await requireTabAccess('tab-reports', cleanDepartment);

  const resolvedSearch = searchParams ? await searchParams : {};

  // Load the registered organization name and the shared print branding settings.
  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment },
    select: {
      id: true,
      name: true,
      logo: true,
      activeAy: true,
      activeTerm: true,
      reportSchoolName: true,
      reportSchoolAddress: true,
      reportHeaderLeftLogo: true,
      reportHeaderRightLogo: true,
      signatories: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!organization) {
    return <div className="alert alert-danger p-4">Department Not Found</div>;
  }

  const ay = resolvedSearch.ay || organization.activeAy || 'A.Y. 2026 - 2027';
  const term = resolvedSearch.term || organization.activeTerm || '1st Sem';

  // 1. Fetch dynamic package data from the central financial engine.
  const financials = await getDepartmentFinancials(organization.id, ay, term);

  // 2. Fetch the master student roster and setup categories.
  const [students, setups] = await Promise.all([
    prisma.student.findMany({
      where: { organizationId: organization.id },
      orderBy: { fullName: 'asc' },
    }),
    prisma.collectionSetup.findMany({
      where: {
        organizationId: organization.id,
        academicYear: ay,
        term,
      },
    }),
  ]);

  // Fee report categories are owned by Fee Setup. Item names and historical
  // receipt descriptions must NOT become additional report categories.
  const setupCategories = Array.from(new Set(setups.map((setup) => setup.category.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));

  // 3. Fetch detailed financial records for the selected term.
  const [collections, liquidations, penalties] = await Promise.all([
    prisma.collection.findMany({
      where: {
        organizationId: organization.id,
        academicYear: ay,
        term,
      },
      orderBy: { timestamp: 'desc' },
    }),
    prisma.audit
      .findMany({
        where: {
          organizationId: organization.id,
          academicYear: ay,
          term,
        },
      })
      .catch(() => []),
    prisma.penalty.findMany({
      where: {
        organizationId: organization.id,
        academicYear: ay,
        term,
      },
    }),
  ]);

  // Ensure database records are serialized before passing them to the client component.
  const serialize = (data: any[]) => JSON.parse(JSON.stringify(data || []));

  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm">
      <ReportsClient
        department={cleanDepartment}
        orgName={organization.name}
        ay={ay}
        term={term}
        orgId={organization.id}
        logoUrl={organization.logo}
        reportSchoolName={organization.reportSchoolName ?? ''}
        reportSchoolAddress={organization.reportSchoolAddress ?? ''}
        reportHeaderLeftLogo={organization.reportHeaderLeftLogo ?? ''}
        reportHeaderRightLogo={organization.reportHeaderRightLogo ?? ''}
        initialSignatories={organization.signatories || []}
        students={serialize(students)}
        collections={serialize(collections)}
        liquidations={serialize(liquidations)}
        penalties={serialize(penalties)}
        packageRate={financials.termPkg.total}
        setupCategories={setupCategories}
        termPkgItems={financials.termPkg.items}
        remainingBalance={financials.remainingBalance}
        carriedIn={financials.carryOverInboundTotal}
        carriedOut={financials.carryOverOutboundTotal}
      />
    </div>
  );
}
