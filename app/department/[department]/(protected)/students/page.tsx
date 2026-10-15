// /app/department/[department]/(protected)/students/page.tsx

import { prisma } from '@/lib/prisma';
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
  const resolvedSearch = searchParams ? await searchParams : {};
  const search = resolvedSearch.search || '';
  const yearFilter = resolvedSearch.year || 'ALL';
  const statusFilter = resolvedSearch.status || 'ALL';
  const page = parseInt(resolvedSearch.page || '1', 10);
  const pageSize = 10;
  const ay = resolvedSearch.ay || 'A.Y. 2026 - 2027';
  const term = resolvedSearch.term || '1st Sem';

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

  // 1. Build dynamic Prisma where clause for the main list
  const whereClause: any = {
    organizationId: organization.id,
    ...(search ? {
      OR: [
        { studentId: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    } : {}),
    ...(yearFilter !== 'ALL' ? { yearLevel: yearFilter } : {}),
  };

  // Push status filtering to DB layer to ensure accurate pagination
  if (statusFilter === 'Inactive') {
    whereClause.enrollments = {
      some: { academicYear: ay, term, enrollmentStatus: { not: 'Enrolled' } }
    };
  } else if (statusFilter === 'Enrolled') {
    whereClause.NOT = {
      enrollments: {
        some: { academicYear: ay, term, enrollmentStatus: { not: 'Enrolled' } }
      }
    };
  }

  // 2. Fetch overall metrics and paginated records concurrently
  const [totalDirectory, absoluteInactiveCount, totalFiltered, students] = await Promise.all([
    // A. Grand total of all students in this department
    prisma.student.count({ where: { organizationId: organization.id } }),
    
    // B. Grand total of inactive students for this specific term
    prisma.student.count({
      where: {
        organizationId: organization.id,
        enrollments: {
          some: { academicYear: ay, term, enrollmentStatus: { not: 'Enrolled' } }
        }
      }
    }),

    // C. Total count matching current search & filters (for pagination math)
    prisma.student.count({ where: whereClause }),

    // D. The actual paginated student records
    prisma.student.findMany({
      where: whereClause,
      include: {
        enrollments: {
          where: { academicYear: ay, term },
        },
      },
      orderBy: { fullName: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // 3. Calculate accurate top-level department metrics
  const notEnrolledCount = absoluteInactiveCount;
  const enrolledCount = totalDirectory - notEnrolledCount;

  // 4. Format the final output array
  const formattedStudents = students.map(s => {
    const termEnrollment = s.enrollments[0];
    const status = termEnrollment?.enrollmentStatus || 'Enrolled';
    
    return {
      id: s.id,
      studentId: s.studentId,
      fullName: s.fullName,
      yearLevel: s.yearLevel,
      email: s.email,
      status: status,
    };
  });

  // Safe pagination division
  const totalPages = Math.ceil(totalFiltered / pageSize);

  return (
    <div className="module p-0 bg-transparent border-0 shadow-none">
      <StudentsClient 
        department={department}
        organizationId={organization.id}
        ay={ay}
        term={term}
        initialStudents={formattedStudents}
        totalDirectory={totalDirectory}
        enrolledCount={enrolledCount}
        notEnrolledCount={notEnrolledCount}
        currentPage={page}
        totalPages={totalPages}
        currentSearch={search}
        currentYear={yearFilter}
        currentStatus={statusFilter}
      />
    </div>
  );
}