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
  const page = Math.max(1, parseInt(resolvedSearch.page || '1', 10));
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

  // 🚀 FIX: Require an explicit Enrollment row to determine active enrollment status correctly
  if (statusFilter === 'Enrolled') {
    whereClause.enrollments = {
      some: { academicYear: ay, term, enrollmentStatus: 'Enrolled' }
    };
  } else if (statusFilter === 'Inactive') {
    whereClause.OR = [
      {
        enrollments: {
          some: { academicYear: ay, term, enrollmentStatus: { not: 'Enrolled' } }
        }
      },
      {
        enrollments: {
          none: { academicYear: ay, term }
        }
      }
    ];
  }

  const [totalDirectory, absoluteEnrolledCount, totalFiltered, students] = await Promise.all([
    prisma.student.count({ where: { organizationId: organization.id } }),
    prisma.student.count({
      where: {
        organizationId: organization.id,
        enrollments: {
          some: { academicYear: ay, term, enrollmentStatus: 'Enrolled' }
        }
      }
    }),
    prisma.student.count({ where: whereClause }),
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
        currentPage={page}
        totalPages={totalPages}
        currentSearch={search}
        currentYear={yearFilter}
        currentStatus={statusFilter}
      />
    </div>
  );
}