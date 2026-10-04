import { prisma } from '@/lib/prisma';
import StudentsClient from './StudentsClient';

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
  const pageSize = 10; // 👈 Updated limit to 10 students per page
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

  // Build dynamic Prisma where clause
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

  // Fetch total count and paginated students concurrently
  const [totalDirectory, students] = await Promise.all([
    prisma.student.count({ where: { organizationId: organization.id } }),
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

  let enrolledCount = 0;
  let notEnrolledCount = 0;

  const formattedStudents = students.map(s => {
    const termEnrollment = s.enrollments[0];
    const status = termEnrollment?.enrollmentStatus || 'Enrolled';
    
    if (status === 'Enrolled') enrolledCount++;
    else notEnrolledCount++;

    return {
      id: s.id,
      studentId: s.studentId,
      fullName: s.fullName,
      yearLevel: s.yearLevel,
      email: s.email,
      status: status,
    };
  });

  const filteredStudents = statusFilter === 'ALL' 
    ? formattedStudents 
    : formattedStudents.filter(s => s.status === statusFilter);

  const totalPages = Math.ceil(totalDirectory / pageSize);

  return (
    <div className="module p-0 bg-transparent border-0 shadow-none">
      <StudentsClient 
        department={department}
        organizationId={organization.id}
        ay={ay}
        term={term}
        initialStudents={filteredStudents}
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