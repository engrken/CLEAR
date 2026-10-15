// /app/department/[department]/(protected)/penalties/page.tsx

import { prisma } from '@/lib/prisma';
import { requireTabAccess } from '@/lib/permissions';
import PenaltiesManager from './PenaltiesManager';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

export default async function PenaltiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{ ay?: string; term?: string }>;
}) {
  const { department } = await params;
  const cleanDepartment = decodeURIComponent(department).trim().toLowerCase();

  // 🚀 SECURITY FIX: Enforce tab-level permissions for penalties access
  await requireTabAccess('tab-penalties', cleanDepartment);

  const resolvedSearch = searchParams ? await searchParams : {};

  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment },
    select: {
      id: true,
      activeAy: true,
      activeTerm: true,
    }
  });

  if (!organization) {
    return (
      <div className="alert alert-danger p-4 shadow-sm border-secondary">
        <h4 className="fw-bold mb-2">Department Not Found</h4>
        <p className="small mb-0">The department '{decodeURIComponent(department)}' does not exist.</p>
      </div>
    );
  }

  // 🚀 Dynamically link academic year and term to organization database defaults
  const ay = resolvedSearch.ay || organization.activeAy || 'A.Y. 2026 - 2027';
  const term = resolvedSearch.term || organization.activeTerm || '1st Sem';

  // Fetch Students and Logged Penalties in parallel
  const [students, penalties] = await Promise.all([
    prisma.student.findMany({
      where: { organizationId: organization.id },
      select: { studentId: true, fullName: true, email: true }
    }),
    prisma.penalty.findMany({
      where: {
        organizationId: organization.id,
        academicYear: ay,
        term,
        status: {
          not: {
            contains: 'Voided',
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    })
  ]);

  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm">
      <h5 className="text-accent mb-2"><i className="bi bi-exclamation-octagon me-2"></i>Student Penalties Assessment</h5>
      <p className="text-secondary small mb-3">Standard rate: <strong>₱50.00 / hour late</strong>. Unsettled fines automatically place a clearance hold.</p>
      
      <PenaltiesManager 
        department={cleanDepartment}
        ay={ay}
        term={term}
        students={students}
        penalties={penalties}
      />
    </div>
  );
}