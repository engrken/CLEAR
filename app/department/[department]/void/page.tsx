import { prisma } from '@/lib/prisma';
import VoidClient from './VoidClient';

interface PageProps {
  params: Promise<{ department: string }>;
  searchParams: Promise<{ category?: string; page?: string }>;
}

export default async function VoidTransactionsPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  
  // 1. Properly decode and clean the department string to match the database
  const department = resolvedParams?.department || 'engineering';
  const cleanDepartment = decodeURIComponent(department).toLowerCase().trim();
  
  const category = resolvedSearch?.category || 'collections';
  const page = parseInt(resolvedSearch?.page || '1', 10);
  const pageSize = 10;
  const skip = (page - 1) * pageSize;

  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment },
  });

  // 2. Add an explicit error state if the department isn't found
  if (!organization) {
    return (
      <div className="alert alert-danger p-4 shadow-sm border-secondary m-4">
        <h4 className="fw-bold mb-2">Department Not Found</h4>
        <p className="small mb-0">The department '{cleanDepartment}' does not exist in the database.</p>
      </div>
    );
  }

  let records: any[] = [];
  let totalCount = 0;

  // 3. Make all exclusion filters case-insensitive and account for legacy data
  if (category === 'collections') {
    const where = { 
      organizationId: organization.id, 
      status: { not: { contains: 'VOID', mode: 'insensitive' as const } },
      paymentType: { not: { contains: 'VOID', mode: 'insensitive' as const } } // Catch legacy sheet data
    };
    totalCount = await prisma.collection.count({ where });
    records = await prisma.collection.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { student: true },
      skip,
      take: pageSize,
    });
  } else if (category === 'penalties') {
    const where = { 
      organizationId: organization.id, 
      status: { not: { contains: 'Voided', mode: 'insensitive' as const } } 
    };
    totalCount = await prisma.penalty.count({ where });
    records = await prisma.penalty.findMany({
      where,
      orderBy: { date: 'desc' },
      skip,
      take: pageSize,
    });
  } else if (category === 'advances') {
    const where = { 
      organizationId: organization.id, 
      status: { not: { contains: 'Cancelled', mode: 'insensitive' as const } } 
    };
    totalCount = await prisma.cashAdvance.count({ where });
    records = await prisma.cashAdvance.findMany({
      where,
      orderBy: { dateIssued: 'desc' },
      skip,
      take: pageSize,
    });
  } else if (category === 'collectibles') {
    const where = { 
      organizationId: organization.id, 
      status: { not: { contains: 'Void', mode: 'insensitive' as const } } 
    };
    totalCount = await prisma.collectible.count({ where });
    records = await prisma.collectible.findMany({
      where,
      orderBy: { academicYear: 'desc' },
      skip,
      take: pageSize,
    });
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // 4. Safely map data to generic rows for the Client component
  const serializedRecords = records.map(r => ({
    id: r.id,
    date: new Date(r.date || r.dateIssued || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
    refId: r.orNumber || r.penaltyId || r.advanceId || r.id.slice(0, 8).toUpperCase(),
    name: r.student?.fullName || r.studentName || r.requestor || 'N/A',
    particulars: r.itemDescription || r.activity || r.purpose || r.category || '-',
    amount: r.amountPaid || r.fineAmount || r.amountApproved || r.balanceDue || 0,
    extra: r.fundSource || r.paymentType || r.status || '-'
  }));

  return (
    <VoidClient 
      initialRecords={serializedRecords} 
      department={cleanDepartment} 
      category={category} 
      currentPage={page}
      totalPages={totalPages}
    />
  );
}