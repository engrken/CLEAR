import { formatManilaShortDate } from '@/lib/clear-timezone';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireTabAccess } from '@/lib/permissions';
import { decodeStudentDue } from '../collectibles/due-link';
import VoidClient from './VoidClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Void Center | CLEAR System' };

type VoidCategory = 'collections' | 'penalties' | 'advances' | 'collectibles';
type Search = { category?: string; page?: string; pageSize?: string; q?: string; ay?: string; term?: string };

type RecordEntry = {
  id: string;
  date: string;
  refId: string;
  name: string;
  particulars: string;
  amount: number;
  extra: string;
};

function positiveInt(value: unknown, fallback: number): number {
  const text = String(value ?? '');
  if (!/^[1-9]\d{0,6}$/.test(text)) return fallback;
  const number = Number(text);
  return Number.isSafeInteger(number) ? number : fallback;
}

function dateLabel(value: Date | null | undefined): string {
  if (!value) return '—';
  return formatManilaShortDate(value);
}

export default async function VoidTransactionsPage({ params, searchParams }: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<Search>;
}) {
  const { department } = await params;
  const request = searchParams ? await searchParams : {};
  const slug = decodeURIComponent(department).trim().toLowerCase();
  await requireTabAccess('tab-void', slug);

  const allowed: VoidCategory[] = ['collections', 'penalties', 'advances', 'collectibles'];
  const category: VoidCategory = allowed.includes(request.category as VoidCategory)
    ? request.category as VoidCategory : 'collections';
  const q = String(request.q ?? '').trim().slice(0, 100);
  const pageSizeCandidate = positiveInt(request.pageSize, 10);
  const pageSize = [10, 25, 50, 100].includes(pageSizeCandidate) ? pageSizeCandidate : 10;

  const organization = await prisma.organization.findUnique({
    where: { subdomain: slug }, select: { id: true, activeAy: true, activeTerm: true },
  });
  if (!organization) {
    return <div className="alert alert-danger p-4">Department not found.</div>;
  }
  const ay = request.ay || organization.activeAy || 'A.Y. 2026 - 2027';
  const term = request.term || organization.activeTerm || '1st Sem';

  // Search all matching database records BEFORE applying pagination. Never filter
  // just the currently visible page or merge records across organizations.
  // Collections can match the linked student with a database relation
  // predicate. Do not materialize every matching roster ID in JavaScript
  // on the most frequently viewed Void Center tab.
  let matchingStudents: Array<{ studentId: string }> = [];
  if (q && category !== 'collections') {
    matchingStudents = await prisma.student.findMany({
      where: {
        organizationId: organization.id,
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { studentId: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { studentId: true },
    });
  }
  const matchedRosterIds = matchingStudents.map(s => s.studentId);

  let totalCount = 0;
  let page = positiveInt(request.page, 1);
  let totalPages = 1;
  let records: RecordEntry[] = [];
  const paging = async <T,>(countFn: () => Promise<number>, listFn: (skip: number) => Promise<T[]>): Promise<T[]> => {
    totalCount = await countFn();
    totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    page = Math.min(page, totalPages);
    return listFn((page - 1) * pageSize);
  };

  if (category === 'collections') {
    const where: Prisma.CollectionWhereInput = {
      organizationId: organization.id, academicYear: ay, term,
      NOT: [
        { status: { contains: 'void', mode: 'insensitive' } },
        { paymentType: { contains: 'void', mode: 'insensitive' } },
      ],
      ...(q ? { OR: [
        { studentName: { contains: q, mode: 'insensitive' as const } },
        { orNumber: { contains: q, mode: 'insensitive' as const } },
        { itemDescription: { contains: q, mode: 'insensitive' as const } },
        { category: { contains: q, mode: 'insensitive' as const } },
        { student: { is: {
          organizationId: organization.id,
          OR: [
            { fullName: { contains: q, mode: 'insensitive' as const } },
            { studentId: { contains: q, mode: 'insensitive' as const } },
          ],
        } } },

      ] } : {}),
    };
    const rows = await paging(
      () => prisma.collection.count({ where }),
      (skip) => prisma.collection.findMany({ where, include: { student: { select: { fullName: true } } },
        orderBy: [{ date: 'desc' }, { id: 'desc' }], skip, take: pageSize }),
    );
    records = rows.map(row => ({
      id: row.id, date: dateLabel(row.date), refId: row.orNumber,
      name: row.student?.fullName || row.studentName || '—',
      particulars: row.itemDescription || row.category || '—',
      amount: Number(row.amountPaid || 0), extra: row.fundAllocation || row.paymentType || '—',
    }));
  } else if (category === 'penalties') {
    const where: Prisma.PenaltyWhereInput = {
      organizationId: organization.id, academicYear: ay, term,
      NOT: { status: { contains: 'void', mode: 'insensitive' } },
      ...(q ? { OR: [
        { studentName: { contains: q, mode: 'insensitive' as const } },
        { studentId: { contains: q, mode: 'insensitive' as const } },
        { penaltyId: { contains: q, mode: 'insensitive' as const } },
        { activity: { contains: q, mode: 'insensitive' as const } },
        ...(matchedRosterIds.length ? [{ studentId: { in: matchedRosterIds } }] : []),
      ] } : {}),
    };
    const rows = await paging(
      () => prisma.penalty.count({ where }),
      (skip) => prisma.penalty.findMany({ where,
        orderBy: [{ date: 'desc' }, { id: 'desc' }], skip, take: pageSize }),
    );
    records = rows.map(row => ({
      id: row.id, date: dateLabel(row.date), refId: row.penaltyId,
      name: row.studentName || '—', particulars: row.activity || '—',
      amount: Number(row.fineAmount || 0), extra: row.status || '—',
    }));
  } else if (category === 'advances') {
    const where: Prisma.CashAdvanceWhereInput = {
      organizationId: organization.id, academicYear: ay, term,
      NOT: { status: { contains: 'cancel', mode: 'insensitive' } },
      ...(q ? { OR: [
        { requestor: { contains: q, mode: 'insensitive' as const } },
        { advanceId: { contains: q, mode: 'insensitive' as const } },
        { purpose: { contains: q, mode: 'insensitive' as const } },
        ...matchedRosterIds.map(id => ({ requestor: { contains: id, mode: 'insensitive' as const } })),
      ] } : {}),
    };
    const rows = await paging(
      () => prisma.cashAdvance.count({ where }),
      (skip) => prisma.cashAdvance.findMany({ where,
        orderBy: [{ dateIssued: 'desc' }, { id: 'desc' }], skip, take: pageSize }),
    );
    records = rows.map(row => ({
      id: row.id, date: dateLabel(row.dateIssued), refId: row.advanceId,
      name: row.requestor || '—', particulars: row.purpose || '—',
      amount: Number(row.amountApproved || 0), extra: row.fundSource || '—',
    }));
  } else {
    // Collectible student associations are encoded in the legacy status field.
    // Search that marker in the database instead of loading an entire ledger.
    const where: Prisma.CollectibleWhereInput = {
      organizationId: organization.id, academicYear: ay, term,
      NOT: { status: { contains: 'void', mode: 'insensitive' } },
      ...(q ? { OR: [
        { id: { contains: q, mode: 'insensitive' as const } },
        { category: { contains: q, mode: 'insensitive' as const } },
        { status: { contains: q, mode: 'insensitive' as const } },
        ...matchedRosterIds.map(id => ({ status: {
          contains: `|SID:${encodeURIComponent(id)}|`, mode: 'insensitive' as const,
        } })),
      ] } : {}),
    };
    const rows = await paging(
      () => prisma.collectible.count({ where }),
      (skip) => prisma.collectible.findMany({ where,
        orderBy: [{ id: 'desc' }], skip, take: pageSize }),
    );
    const rosterIds = Array.from(new Set(rows.map(row => decodeStudentDue(row.status)?.studentId).filter((s): s is string => !!s)));
    const roster = rosterIds.length ? await prisma.student.findMany({
      where: { organizationId: organization.id, studentId: { in: rosterIds } },
      select: { studentId: true, fullName: true },
    }) : [];
    const names = new Map(roster.map(s => [s.studentId.toLowerCase(), s.fullName]));
    records = rows.map(row => {
      const marker = decodeStudentDue(row.status);
      return {
        id: row.id, date: '—', refId: row.id,
        name: marker ? `${names.get(marker.studentId.toLowerCase()) || marker.studentId} (${marker.studentId})` : 'Summary assessment',
        particulars: marker?.itemDescription || row.category || '—',
        amount: Number(row.balanceDue || 0), extra: row.status || '—',
      };
    });
  }

  return <VoidClient
    initialRecords={records}
    department={slug}
    category={category}
    currentPage={page}
    totalPages={totalPages}
    totalCount={totalCount}
    pageSize={pageSize}
    query={q}
    ay={ay}
    term={term}
  />;
}
