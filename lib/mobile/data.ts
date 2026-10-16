// /lib/mobile/data.ts
//
// Read models for the mobile API (ledger, students, dashboard, fees, remittance
// detail). All queries are scoped to the organization passed in; callers have
// already authorized access to it.

import type { Organization } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { computeDepartmentFinancials, isVoidedRecord } from '@/lib/financials';
import { normalizeDepartmentSlug } from '@/lib/permissions';
import { ApiFailure } from '@/lib/mobile/http';
import { toCentavos } from '@/lib/mobile/serialize';

export async function getOrgOr404(slug: string) {
  const org = await prisma.organization.findUnique({ where: { subdomain: normalizeDepartmentSlug(slug) } });
  if (!org) throw new ApiFailure(404, 'not_found', 'This department is not registered in CLEAR.');
  return org;
}

export type LedgerEntry = {
  id: string;
  kind: 'collection' | 'online-remittance' | 'penalty' | 'advance' | 'cashier-remittance';
  title: string;
  reference: string;
  subtitle: string;
  amountCentavos: number;
  status: string;
  at: string;
};

type CollectionRow = {
  id: string; studentName: string; orNumber: string; itemDescription: string;
  amountPaid: number; status: string; paymentType: string; timestamp: Date;
};

export function collectionEntry(c: CollectionRow): LedgerEntry {
  return {
    id: c.id,
    kind: 'collection',
    title: c.studentName,
    reference: c.orNumber,
    subtitle: c.itemDescription,
    amountCentavos: toCentavos(c.amountPaid),
    status: isVoidedRecord(c) ? 'Voided' : c.status,
    at: c.timestamp.toISOString(),
  };
}

type RemittanceRow = {
  id: string; studentName: string; referenceNumber: string; itemDescription: string;
  paymentChannel: string; amountPaid: number; status: string; timestamp: Date;
};

export function remittanceEntry(r: RemittanceRow): LedgerEntry {
  return {
    id: r.id,
    kind: 'online-remittance',
    title: r.studentName,
    reference: r.referenceNumber,
    subtitle: [r.itemDescription, r.paymentChannel].filter(Boolean).join(' · '),
    amountCentavos: toCentavos(r.amountPaid),
    status: r.status,
    at: r.timestamp.toISOString(),
  };
}

const MAX_LEDGER = 200;

/** Newest-first activity across the five money tables for the org's active term. */
export async function listLedger(org: Organization, opts: { status?: string | null; limit?: number }) {
  const limit = Math.min(MAX_LEDGER, Math.max(1, opts.limit || 100));
  const where = { organizationId: org.id, academicYear: org.activeAy, term: org.activeTerm };
  const take = limit;

  const [collections, remittances, penalties, advances, cashier] = await Promise.all([
    prisma.collection.findMany({ where, orderBy: { timestamp: 'desc' }, take }),
    prisma.onlineRemittance.findMany({ where, orderBy: { timestamp: 'desc' }, take }),
    prisma.penalty.findMany({ where, orderBy: { date: 'desc' }, take }),
    prisma.cashAdvance.findMany({ where, orderBy: { dateIssued: 'desc' }, take }),
    prisma.cashierRemittance.findMany({ where, orderBy: { date: 'desc' }, take }),
  ]);

  const entries: LedgerEntry[] = [
    ...collections.map(collectionEntry),
    ...remittances.map(remittanceEntry),
    ...penalties.map((p) => ({
      id: p.id,
      kind: 'penalty' as const,
      title: p.studentName,
      reference: p.penaltyId,
      subtitle: `${p.activity} · ${p.hoursLate} hr${p.hoursLate === 1 ? '' : 's'} late`,
      amountCentavos: toCentavos(p.fineAmount),
      status: p.status,
      at: p.date.toISOString(),
    })),
    ...advances.map((a) => ({
      id: a.id,
      kind: 'advance' as const,
      title: a.requestor,
      reference: a.advanceId,
      subtitle: a.purpose || a.fundSource,
      amountCentavos: toCentavos(a.amountApproved),
      status: a.status,
      at: a.dateIssued.toISOString(),
    })),
    ...cashier.map((c) => ({
      id: c.id,
      kind: 'cashier-remittance' as const,
      title: c.remittedBy,
      reference: c.cashierReceiptNo || c.remittanceId,
      subtitle: `${c.fundSource} · ${c.type}`,
      amountCentavos: toCentavos(c.amount),
      status: c.status,
      at: c.date.toISOString(),
    })),
  ];

  const status = String(opts.status || '').trim();
  return entries
    .filter((e) => !status || e.status === status)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, limit);
}

export async function listStudents(org: Organization, query?: string | null) {
  const q = String(query || '').trim();
  const students = await prisma.student.findMany({
    where: {
      organizationId: org.id,
      ...(q
        ? { OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { studentId: { contains: q, mode: 'insensitive' } }] }
        : {}),
    },
    orderBy: { fullName: 'asc' },
    take: 500,
    include: {
      enrollments: {
        where: { academicYear: org.activeAy, term: org.activeTerm },
        select: { enrollmentStatus: true },
        take: 1,
      },
    },
  });

  return students.map((s) => ({
    id: s.id,
    studentId: s.studentId,
    fullName: s.fullName,
    yearLevel: s.yearLevel,
    enrollmentStatus: s.enrollments[0]?.enrollmentStatus === 'Enrolled' ? 'Enrolled' : 'Dropped',
  }));
}

export async function listFeeItems(org: Organization) {
  const items = await prisma.collectionSetup.findMany({
    where: { organizationId: org.id, academicYear: org.activeAy, term: org.activeTerm },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  return items.map((i) => ({
    id: i.id,
    category: i.category,
    name: i.name,
    amountCentavos: toCentavos(i.amount),
    targetFund: i.targetFund,
  }));
}

/** Start of "today" in Asia/Manila (UTC+8, no DST), as a UTC instant. */
function startOfManilaDay(now = new Date()) {
  const offset = 8 * 60 * 60 * 1000;
  const day = 24 * 60 * 60 * 1000;
  return new Date(Math.floor((now.getTime() + offset) / day) * day - offset);
}

export async function dashboardSummary(org: Organization) {
  const ay = org.activeAy;
  const term = org.activeTerm;
  const [fin, pending, todays] = await Promise.all([
    computeDepartmentFinancials(org.id, ay, term),
    prisma.onlineRemittance.findMany({
      where: { organizationId: org.id, academicYear: ay, term, status: 'Pending Verification' },
      select: { amountPaid: true },
    }),
    prisma.collection.findMany({
      where: { organizationId: org.id, academicYear: ay, term, timestamp: { gte: startOfManilaDay() } },
      select: { status: true, paymentType: true },
    }),
  ]);

  return {
    ay,
    term,
    cashOnHandCentavos: toCentavos(fin.remainingBalance - fin.cashierBalance),
    safekeepingCentavos: toCentavos(fin.cashierBalance),
    pendingCentavos: pending.reduce((sum, r) => sum + toCentavos(r.amountPaid), 0),
    pendingCount: pending.length,
    outstandingCentavos: toCentavos(fin.totalCollectibles),
    outstandingStudents: fin.unpaidPackageStudents,
    collectionsToday: todays.filter((c) => !isVoidedRecord(c)).length,
  };
}

export async function remittanceDetail(org: Organization, id: string) {
  const r = await prisma.onlineRemittance.findFirst({ where: { id, organizationId: org.id } });
  if (!r) throw new ApiFailure(404, 'not_found', 'Online remittance record not found.');
  return {
    ...remittanceEntry(r),
    studentId: r.studentId,
    studentEmail: r.studentEmail,
    paymentChannel: r.paymentChannel,
    itemDescription: r.itemDescription,
    orNumber: r.orNumber,
    proofDataUrl: r.proofUrl && r.proofUrl.startsWith('data:image/') ? r.proofUrl : null,
    reviewNotes: r.reviewNotes,
    reviewedBy: r.reviewedBy,
  };
}
