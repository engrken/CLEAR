// /lib/mobile/data.ts
//
// Read models for the mobile API (ledger, students, dashboard, fees, remittance
// detail). All queries are scoped to the organization passed in; callers have
// already authorized access to it. Money rules follow Ken's web code: the
// dashboard uses lib/financials.ts (a mirror of his getDepartmentFinancials) and
// the period-closed flag uses his realign ledger helpers.
//
// Response shapes are additive only: app 1.0.0 reads the original fields.

import type { Organization } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { computeDepartmentFinancials, isVoidedRecord } from '@/lib/financials';
import { isOrganizationActive, normalizeDepartmentSlug } from '@/lib/roles';
import { ApiFailure } from '@/lib/mobile/http';
import { toCentavos } from '@/lib/mobile/serialize';
import { LedgerReadIntegrityError, ledgerCentavos, legacyPenaltyAssessedCentavos } from '@/lib/mobile/ledger-precision';
import type { MoneyScalar } from '@/lib/money-precision';
import {
  isRolloverSource,
  matchesRolloverSource,
} from '@/app/department/[department]/(protected)/realign/ledger';

/** Public lookups: inactive and archived departments look unregistered to the app. */
export async function getOrgOr404(slug: string) {
  const org = await prisma.organization.findUnique({ where: { subdomain: normalizeDepartmentSlug(slug) } });
  if (!org || !isOrganizationActive(org)) {
    throw new ApiFailure(404, 'not_found', 'This department is not registered in CLEAR.');
  }
  return org;
}

/**
 * True when the period has been closed: an un-reversed rollover out of it, or a
 * formal AcademicPeriodTransition with status Closed. Mirrors how getPeriodLedger
 * (app/department/[department]/(protected)/realign/ledger.ts) derives
 * activeRollover, without loading the period's money tables.
 */
export async function isPeriodClosed(organizationId: string, ay: string, term: string) {
  const [transfers, reversals, formalClosure] = await Promise.all([
    prisma.fundTransfer.findMany({
      where: { organizationId, sourceFund: { contains: 'rollover', mode: 'insensitive' } },
      select: { id: true, sourceFund: true },
    }),
    prisma.voidTransaction.findMany({
      where: { organizationId, transactionType: 'ROLLOVER_REVERSAL' },
      select: { referenceId: true },
    }),
    prisma.academicPeriodTransition.findFirst({
      where: { organizationId, sourceAY: ay, sourceTerm: term, status: 'Closed' },
      select: { id: true },
    }),
  ]);
  if (formalClosure) return true;
  const reversed = new Set(reversals.map((r) => String(r.referenceId ?? '').trim()));
  return transfers.some(
    (t) => isRolloverSource(t.sourceFund) && !reversed.has(String(t.id)) && matchesRolloverSource(t.sourceFund, ay, term)
  );
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
  // Additions (all optional, per kind):
  /** collection: the main OR this line belongs to (Ken's multi-item receipts add -P02, -P03…). */
  receiptNumber?: string;
  /** collection: 1 for the main line, n for an -Pnn line. */
  receiptLine?: number;
  /** collection: balance left on that item after this receipt. */
  balanceCentavos?: number;
  /** penalty: the original assessment (amountCentavos is the live balance). */
  assessedCentavos?: number;
  /** penalty: 'SERVICE_ELIGIBLE' | 'LATE_FEE'. */
  penaltyType?: string;
};

type CollectionRow = {
  id: string; studentName: string; orNumber: string; itemDescription: string;
  amountPaid: MoneyScalar; status: string; paymentType: string; timestamp: Date;
  balanceDue?: MoneyScalar | null;
};

/** Splits Ken's multi-item receipt numbers: "OR-1-P02" → { receiptNumber: "OR-1", receiptLine: 2 }. */
export function receiptParts(orNumber: string) {
  const m = /^(.+)-P(\d{2,})$/.exec(String(orNumber || ''));
  return m ? { receiptNumber: m[1], receiptLine: Number(m[2]) } : { receiptNumber: orNumber, receiptLine: 1 };
}

export function collectionEntry(c: CollectionRow): LedgerEntry {
  return {
    id: c.id,
    kind: 'collection',
    title: c.studentName,
    reference: c.orNumber,
    subtitle: c.itemDescription,
    amountCentavos: ledgerCentavos('collection', 'amountPaid', c.amountPaid),
    status: isVoidedRecord(c) ? 'Voided' : c.status,
    at: c.timestamp.toISOString(),
    ...receiptParts(c.orNumber),
    ...(c.balanceDue != null ? { balanceCentavos: ledgerCentavos('collection', 'balanceDue', c.balanceDue) } : {}),
  };
}

type RemittanceRow = {
  id: string; studentName: string; referenceNumber: string; itemDescription: string;
  paymentChannel: string; amountPaid: MoneyScalar; status: string; timestamp: Date;
};

export function remittanceEntry(r: RemittanceRow): LedgerEntry {
  return {
    id: r.id,
    kind: 'online-remittance',
    title: r.studentName,
    reference: r.referenceNumber,
    subtitle: [r.itemDescription, r.paymentChannel].filter(Boolean).join(' · '),
    amountCentavos: ledgerCentavos('online-remittance', 'amountPaid', r.amountPaid),
    status: r.status,
    at: r.timestamp.toISOString(),
  };
}

type PenaltyRow = {
  id: string; studentName: string; penaltyId: string; activity: string; hoursLate: number;
  ratePerHour: MoneyScalar; fineAmount: MoneyScalar; assessedAmount: MoneyScalar | null; penaltyType: string;
  status: string; date: Date;
};

/** Ken stores minutes / 60 in hoursLate; Late Fees are flat and have no duration. */
function penaltySubtitle(p: PenaltyRow) {
  if (p.penaltyType === 'LATE_FEE') return `${p.activity} · Late fee`;
  const minutes = Math.round((Number(p.hoursLate) || 0) * 60);
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${p.activity} · ${hours} hr${hours === 1 ? '' : 's'} late`;
  }
  return `${p.activity} · ${minutes} min late`;
}

export function penaltyEntry(p: PenaltyRow): LedgerEntry {
  return {
    id: p.id,
    kind: 'penalty',
    title: p.studentName,
    reference: p.penaltyId,
    subtitle: penaltySubtitle(p),
    amountCentavos: ledgerCentavos('penalty', 'fineAmount', p.fineAmount),
    status: p.status,
    at: p.date.toISOString(),
    // Legacy null assessedAmount: reconstruct from integer minutes and exact
    // hourly centavos using the same rounding rule as the web penalty actions.
    assessedCentavos: p.assessedAmount != null
      ? ledgerCentavos('penalty', 'assessedAmount', p.assessedAmount)
      : legacyPenaltyAssessedCentavos(p.hoursLate, p.ratePerHour),
    penaltyType: p.penaltyType,
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

  // Convert each record only after the authorized, tenant/period-scoped reads.
  // Never silently round, replace a malformed amount with zero, or return a
  // partial ledger as a complete financial history to existing Android apps.
  let entries: LedgerEntry[];
  try {
    const entries: LedgerEntry[] = [
    ...collections.map(collectionEntry),
    ...remittances.map(remittanceEntry),
    ...penalties.map(penaltyEntry),
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
  } catch (error) {
    if (error instanceof LedgerReadIntegrityError) {
      // Fixed code-only metadata: no amounts, student identities, receipts,
      // organizational references, bearer tokens or financial source rows.
      console.warn('[api/mobile/ledger] exact-centavo review required', {
        category: error.source, field: error.field,
      });
      throw new ApiFailure(422, 'financial_data_review',
        'This ledger contains an amount requiring financial review. ' +
        'No amount was rounded or changed. Contact an authorized financial administrator.');
    }
    throw error;
  }

  const status = String(opts.status || '').trim();
  return entries
    .filter((e) => !status || e.status === status)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, limit);
}

/**
 * Roster with active-term enrollment, searched like Ken's students page
 * ((protected)/students/page.tsx ~56-64: school ID, name or email).
 * enrollmentStatus stays 'Enrolled' | 'Dropped' for app 1.0.0; termStatus carries
 * Ken's label (the raw enrollment status, or 'Inactive' when there is none).
 */
export async function listStudents(
  org: Organization, query?: string | null, missingEmailOnly = false,
) {
  const q = String(query || '').trim().slice(0, 120);
  const students = await prisma.student.findMany({
    where: {
      organizationId: org.id,
      ...(missingEmailOnly ? { AND: [{ OR: [{ email: null }, { email: '' }] }] } : {}),
      ...(q
        ? {
            OR: [
              { studentId: { contains: q, mode: 'insensitive' } },
              { fullName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { fullName: 'asc' },
    take: missingEmailOnly ? 501 : 500,
    select: {
      id: true, studentId: true, fullName: true, yearLevel: true, email: true,
      enrollments: {
        where: { academicYear: org.activeAy, term: org.activeTerm },
        select: { enrollmentStatus: true },
        take: 1,
      },
    },
  });
  // Never call an incomplete remediation result a full missing-email list.
  if (missingEmailOnly && students.length > 500) {
    throw new ApiFailure(422, 'narrow_search', 'Too many students need email registration; use the authorized paginated web Students Roster.');
  }

  return students.map((s) => {
    const termStatus = s.enrollments[0]?.enrollmentStatus || 'Inactive';
    return {
      id: s.id,
      studentId: s.studentId,
      fullName: s.fullName,
      yearLevel: s.yearLevel,
      enrollmentStatus: termStatus === 'Enrolled' ? ('Enrolled' as const) : ('Dropped' as const),
      // additions
      termStatus,
      email: s.email ?? null,
    };
  });
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

/**
 * Unpaid penalties for the period, as Ken's summary/page.tsx (~133-145) counts them:
 * every non-void/cancelled penalty; fineAmount is the live outstanding balance.
 */
function penaltiesOutstanding(rows: { studentId: string | null; studentName: string; fineAmount: number; status: string }[]) {
  const students = new Set<string>();
  let cents = 0;
  for (const p of rows) {
    if (/VOID|CANCEL/i.test(p.status || '')) continue;
    const id = String(p.studentId || p.studentName || '').trim().toLowerCase();
    const outstanding = Math.round(Number(p.fineAmount || 0) * 100);
    if (id && outstanding > 0) students.add(id);
    cents += outstanding;
  }
  return { cents, students: students.size };
}

export async function dashboardSummary(org: Organization) {
  const ay = org.activeAy;
  const term = org.activeTerm;
  const [fin, pending, todays, penalties] = await Promise.all([
    computeDepartmentFinancials(org.id, ay, term),
    prisma.onlineRemittance.findMany({
      where: { organizationId: org.id, academicYear: ay, term, status: 'Pending Verification' },
      select: { amountPaid: true },
    }),
    prisma.collection.findMany({
      where: { organizationId: org.id, academicYear: ay, term, timestamp: { gte: startOfManilaDay() } },
      select: { status: true, paymentType: true },
    }),
    prisma.penalty.findMany({
      where: { organizationId: org.id, academicYear: ay, term },
      select: { studentId: true, studentName: true, fineAmount: true, status: true },
    }),
  ]);
  const pen = penaltiesOutstanding(penalties.map(p => ({ ...p, fineAmount: Number(p.fineAmount) })));

  return {
    ay,
    term,
    // Ken's DashboardClient: physical cash on hand = remainingBalance − cashierBalance.
    cashOnHandCentavos: toCentavos(fin.remainingBalance - fin.cashierBalance),
    safekeepingCentavos: toCentavos(fin.cashierBalance),
    pendingCentavos: pending.reduce((sum, r) => sum + toCentavos(r.amountPaid), 0),
    pendingCount: pending.length,
    outstandingCentavos: toCentavos(fin.totalCollectibles),
    outstandingStudents: fin.unpaidPackageStudents,
    collectionsToday: todays.filter((c) => !isVoidedRecord(c)).length,
    // additions
    remainingBalanceCentavos: toCentavos(fin.remainingBalance),
    totalCollectedCentavos: toCentavos(fin.grandCollectionTotal),
    totalExpensesCentavos: toCentavos(fin.grandExpenseTotal),
    unliquidatedCentavos: toCentavos(fin.totalUnliquidated),
    carriedInCentavos: toCentavos(fin.carryOverInboundTotal),
    carriedOutCentavos: toCentavos(fin.carryOverOutboundTotal),
    penaltiesOutstandingCentavos: pen.cents,
    penaltiesOutstandingStudents: pen.students,
    periodClosed: fin.hasActiveCarryOver,
    // Web Overview parity: values are serialized from the canonical financial
    // engine; this is read-only and only returned to role-authorized callers.
    depositedCentavos: toCentavos(fin.totalDeposited),
    withdrawnCentavos: toCentavos(fin.totalWithdrawn),
    funds: fin.fundsList.map((f) => ({
      name: f.name,
      initialCentavos: toCentavos(f.initialAllocation),
      transfersCentavos: toCentavos(f.netTransfers),
      collectedCentavos: toCentavos(f.collected),
      disbursedCentavos: toCentavos(f.spent),
      unliquidatedCentavos: toCentavos(f.unliquidated),
      balanceCentavos: toCentavos(f.balance),
    })),
    pendingAdvances: fin.unliquidatedAdvances.map((advance) => ({
      id: advance.id,
      advanceId: advance.advanceId,
      requestor: advance.requestor,
      amountCentavos: toCentavos(advance.amountApproved),
      fund: advance.fund,
      date: advance.date,
      due: advance.due,
      status: advance.status,
    })),
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
