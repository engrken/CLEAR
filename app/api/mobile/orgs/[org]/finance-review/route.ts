// GET /api/mobile/orgs/:org/finance-review?kind=penalties|advances|liquidations|collections
// Recent, current-period financial REVIEW ONLY. All four categories independently
// require the corresponding live server-side officer permission for the tenant.
// This endpoint never allocates ORs, settles fines, approves, liquidates or posts.
import { prisma } from '@/lib/prisma';
import { ApiFailure, handler, preflight } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { toCentavos } from '@/lib/mobile/serialize';

type Ctx = { params: Promise<{ org: string }> };
type Kind = 'penalties' | 'advances' | 'liquidations' | 'collections';
const PERMISSION: Readonly<Record<Kind, string>> = {
  penalties: 'tab-penalties',
  advances: 'tab-advances',
  liquidations: 'tab-audit',
  collections: 'tab-payment',
};
const PAGE_LIMIT = 40;
export const dynamic = 'force-dynamic';

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const query = new URL(req.url).searchParams;
  const kind = query.get('kind');
  if (!kind || !Object.prototype.hasOwnProperty.call(PERMISSION, kind)) {
    throw new ApiFailure(400, 'invalid', 'Choose penalties, advances, liquidations or collections.');
  }
  const mode = kind as Kind;
  const rawLimit = query.get('limit') ?? '20';
  if (!/^[1-9]\d*$/.test(rawLimit) || Number(rawLimit) > PAGE_LIMIT) {
    throw new ApiFailure(400, 'invalid', 'Limit must be between 1 and 40.');
  }
  const limit = Number(rawLimit);
  const { org: slug } = await params;
  // Crucial: authorization precedes any financial record query.
  const { org } = await requireMobileOfficer(req, slug, PERMISSION[mode]);
  const where = { organizationId: org.id, academicYear: org.activeAy, term: org.activeTerm };
  const take = limit + 1;

  if (mode === 'penalties') {
    const rows = await prisma.penalty.findMany({
      where, orderBy: [{ date: 'desc' }, { id: 'desc' }], take,
      select: { id: true, penaltyId: true, studentName: true, activity: true,
        fineAmount: true, status: true, date: true },
    });
    return {
      kind: mode, scope: 'active_period', ay: org.activeAy, term: org.activeTerm,
      limit, hasMore: rows.length > limit, amountMeaning: 'Remaining penalty balance',
      entries: rows.slice(0, limit).map(p => ({
        id: p.id, reference: p.penaltyId, title: p.studentName,
        subtitle: p.activity, status: p.status,
        amountCentavos: toCentavos(p.fineAmount),
        when: p.date.toISOString(),
      })),
    };
  }

  if (mode === 'advances') {
    const rows = await prisma.cashAdvance.findMany({
      where, orderBy: [{ dateIssued: 'desc' }, { id: 'desc' }], take,
      select: { id: true, advanceId: true, requestor: true, purpose: true,
        fundSource: true, amountApproved: true, status: true, dateIssued: true },
    });
    return {
      kind: mode, scope: 'active_period', ay: org.activeAy, term: org.activeTerm,
      limit, hasMore: rows.length > limit, amountMeaning: 'Original approved advance (not current outstanding)',
      entries: rows.slice(0, limit).map(a => ({
        id: a.id, reference: a.advanceId, title: a.requestor,
        subtitle: [a.fundSource, a.purpose].filter(Boolean).join(' · '),
        status: a.status, amountCentavos: toCentavos(a.amountApproved),
        when: a.dateIssued.toISOString(),
      })),
    };
  }

  if (mode === 'liquidations') {
    const rows = await prisma.audit.findMany({
      where, orderBy: [{ date: 'desc' }, { id: 'desc' }], take,
      select: { id: true, auditId: true, referenceCaId: true, requestor: true,
        fundSource: true, totalExpense: true, status: true, date: true },
    });
    return {
      kind: mode, scope: 'active_period', ay: org.activeAy, term: org.activeTerm,
      limit, hasMore: rows.length > limit, amountMeaning: 'Recorded liquidation expense',
      entries: rows.slice(0, limit).map(a => ({
        id: a.id, reference: a.auditId, title: a.requestor,
        subtitle: [a.referenceCaId, a.fundSource].filter(Boolean).join(' · '),
        status: a.status, amountCentavos: toCentavos(a.totalExpense),
        when: a.date.toISOString(),
      })),
    };
  }

  // Collection rows are allocation lines, NOT one row per official receipt.
  // NEVER sum or count these as completed receipts; full canonical grouped
  // Receipt History is available through separately authenticated secure web.
  const rows = await prisma.collection.findMany({
    where, orderBy: [{ timestamp: 'desc' }, { id: 'desc' }], take,
    select: { id: true, orNumber: true, studentName: true, itemDescription: true,
      category: true, amountPaid: true, status: true, timestamp: true },
  });
  return {
    kind: mode, scope: 'active_period', ay: org.activeAy, term: org.activeTerm,
    limit, hasMore: rows.length > limit,
    amountMeaning: 'Individual receipt allocation line (not full OR total)',
    entries: rows.slice(0, limit).map(c => ({
      id: c.id, reference: c.orNumber, title: c.studentName,
      subtitle: [c.category, c.itemDescription].filter(Boolean).join(' · '),
      status: c.status, amountCentavos: toCentavos(c.amountPaid),
      when: c.timestamp.toISOString(),
    })),
  };
});
export const OPTIONS = preflight;
