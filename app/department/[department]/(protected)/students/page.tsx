// /app/department/[department]/(protected)/students/page.tsx

import { prisma } from '@/lib/prisma';
import { requireTabAccess } from '@/lib/permissions';
import StudentsClient from './StudentsClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

export default async function StudentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{ search?: string; year?: string; status?: string; page?: string; ay?: string; term?: string }>;
}) {
  const { department } = await params;
  const cleanDepartment = decodeURIComponent(department).toLowerCase().trim();

  // 🚀 SECURITY FIX: Enforce tab-level permissions for student roster access
  await requireTabAccess('tab-students', cleanDepartment);

  const resolvedSearch = searchParams ? await searchParams : {};
  const search = resolvedSearch.search || '';
  const yearFilter = resolvedSearch.year || 'ALL';
  const statusFilter = resolvedSearch.status || 'ALL';
  const rawPage = Number(resolvedSearch.page || '1');
  const page = Number.isSafeInteger(rawPage) && rawPage >= 1 ? Math.min(rawPage, 100000) : 1;
  const pageSize = 10;

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

  // Preserve search filters when combining enrollment-status filters.
  const andFilters: any[] = [{ organizationId: organization.id }];
  if (search.trim()) {
    const q = search.trim().slice(0, 120);
    andFilters.push({ OR: [
      { studentId: { contains: q, mode: 'insensitive' } },
      { fullName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ] });
  }
  if (yearFilter !== 'ALL') andFilters.push({ yearLevel: yearFilter });
  if (statusFilter === 'Enrolled') {
    andFilters.push({ enrollments: { some: { academicYear: ay, term, enrollmentStatus: 'Enrolled' } } });
  } else if (statusFilter === 'Inactive') {
    andFilters.push({ enrollments: { none: { academicYear: ay, term, enrollmentStatus: 'Enrolled' } } });
  }
  const whereClause = { AND: andFilters };

  // The unfiltered roster count is the directory count: skip a duplicate
  // COUNT(*) on initial load and when returning to the unfiltered list.
  const unfilteredRoster = !search.trim() && yearFilter === 'ALL' && statusFilter === 'ALL';
  const [totalDirectory, absoluteEnrolledCount, studentsMissingEmail, filteredCount, students] = await Promise.all([
    prisma.student.count({ where: { organizationId: organization.id } }),
    prisma.student.count({
      where: {
        organizationId: organization.id,
        enrollments: {
          some: { academicYear: ay, term, enrollmentStatus: 'Enrolled' }
        }
      }
    }),
    prisma.student.count({ where: {
      organizationId: organization.id, OR: [{ email: null }, { email: '' }],
    } }),
    unfilteredRoster ? Promise.resolve(null) : prisma.student.count({ where: whereClause }),
    prisma.student.findMany({
      where: whereClause,
      // Send only the columns rendered by this page, not all student or
      // enrollment metadata. Tenant and period filtering are unchanged.
      select: {
        id: true, studentId: true, fullName: true, yearLevel: true, email: true,
        enrollments: {
          where: { academicYear: ay, term },
          select: { enrollmentStatus: true },
          take: 1,
        },
      },
      orderBy: { fullName: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const totalFiltered = filteredCount ?? totalDirectory;
  const enrolledCount = absoluteEnrolledCount;
  const notEnrolledCount = Math.max(0, totalDirectory - enrolledCount);

  const formattedStudents = students.map(s => {
    const termEnrollment = s.enrollments[0];
    const status = termEnrollment?.enrollmentStatus || 'Inactive';
    
    return {
      id: s.id,
      studentId: s.studentId,
      fullName: s.fullName,
      yearLevel: s.yearLevel,
      email: s.email,
      status: status,
    };
  });

  const totalPages = Math.ceil(totalFiltered / pageSize) || 1;

  return (
    <div className="module p-0 bg-transparent border-0 shadow-none">
      <StudentsClient 
        department={cleanDepartment}
        organizationId={organization.id}
        ay={ay}
        term={term}
        initialStudents={formattedStudents}
        totalDirectory={totalDirectory}
        enrolledCount={enrolledCount}
        notEnrolledCount={notEnrolledCount}
        studentsMissingEmail={studentsMissingEmail}
        currentPage={page}
        totalPages={totalPages}
        currentSearch={search}
        currentYear={yearFilter}
        currentStatus={statusFilter}
      />
    </div>
  );
}