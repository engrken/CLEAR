import { prisma } from '@/lib/prisma';
import VoidClient from './VoidClient';

interface PageProps {
  params: Promise<{ department: string }>;
  searchParams: Promise<{ category?: string; page?: string }>;
}

export default async function VoidTransactionsPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const department = resolvedParams?.department || 'engineering';
  const category = resolvedSearch?.category || 'collections';
  const page = parseInt(resolvedSearch?.page || '1', 10);
  const pageSize = 10;
  const skip = (page - 1) * pageSize;

  const organization = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() },
  });

  let records: any[] = [];
  let totalCount = 0;

  if (organization) {
    if (category === 'collections') {
      const where = { organizationId: organization.id, status: { not: 'VOID' } };
      totalCount = await prisma.collection.count({ where });
      records = await prisma.collection.findMany({
        where,
        orderBy: { date: 'desc' },
        include: { student: true },
        skip,
        take: pageSize,
      });
    } else if (category === 'penalties') {
      const where = { organizationId: organization.id, status: { not: { contains: 'Voided' } } };
      totalCount = await prisma.penalty.count({ where });
      records = await prisma.penalty.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: pageSize,
      });
    } else if (category === 'advances') {
      const where = { organizationId: organization.id, status: { not: { contains: 'Cancelled' } } };
      totalCount = await prisma.cashAdvance.count({ where });
      records = await prisma.cashAdvance.findMany({
        where,
        orderBy: { dateIssued: 'desc' },
        skip,
        take: pageSize,
      });
    } else if (category === 'collectibles') {
      const where = { organizationId: organization.id, status: { not: 'Voided' } };
      totalCount = await prisma.collectible.count({ where });
      records = await prisma.collectible.findMany({
        where,
        orderBy: { academicYear: 'desc' },
        skip,
        take: pageSize,
      });
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const serializedRecords = records.map(r => ({
    id: r.id,
    date: new Date(r.date || r.dateIssued || Date.now()).toLocaleDateString(),
    refId: r.orNumber || r.penaltyId || r.advanceId || r.id.slice(0, 8).toUpperCase(),
    name: r.student?.fullName || r.studentName || r.requestor || 'N/A',
    particulars: r.itemDescription || r.activity || r.purpose || r.category || '-',
    amount: r.amountPaid || r.fineAmount || r.amountApproved || r.balanceDue || 0,
    extra: r.fundSource || r.paymentType || r.status || '-'
  }));

  return (
    <VoidClient 
      initialRecords={serializedRecords} 
      department={department} 
      category={category} 
      currentPage={page}
      totalPages={totalPages}
    />
  );
}