// Additive mobile ledger pagination. The legacy /ledger route must continue
// returning a LedgerEntry[] for Android v1.2.4. Only /ledger/page opts in.
// Every request is authorized by its route before calling this function.
// Keep all five sources sorted using (event time DESC, kind ASC, id DESC).
import type { Organization, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ApiFailure } from '@/lib/mobile/http';
import { collectionEntry, remittanceEntry, penaltyEntry, type LedgerEntry } from '@/lib/mobile/data';
import { LedgerReadIntegrityError, ledgerCentavos } from '@/lib/mobile/ledger-precision';

const KINDS = ['advance', 'cashier-remittance', 'collection', 'online-remittance', 'penalty'] as const;
type Kind = typeof KINDS[number];
type Scope = 'active' | 'all';
type Cursor = { v: 1; org: string; ay: string; term: string; scope: Scope;
  anchor: string; at: string; kind: Kind; id: string };
export type LedgerPage = { records: LedgerEntry[]; nextCursor: string | null; hasMore: boolean;
  scope: Scope; pageSize: number };

function validIso(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}
function parseCursor(raw: string | null | undefined, org: Organization, scope: Scope): Cursor | null {
  if (!raw) return null;
  if (raw.length > 1400 || !/^[A-Za-z0-9_-]+$/.test(raw)) {
    throw new ApiFailure(400, 'invalid_cursor', 'Activity cursor is invalid. Refresh the list.');
  }
  try {
    const c = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<Cursor>;
    if (c.v !== 1 || c.org !== org.id || c.ay !== org.activeAy || c.term !== org.activeTerm ||
        c.scope !== scope || !validIso(c.anchor) || !validIso(c.at) ||
        !KINDS.includes(c.kind as Kind) ||
        typeof c.id !== 'string' || c.id.length < 1 || c.id.length > 120 ||
        c.at > c.anchor) throw new Error('Cursor not valid for this tenant/period');
    return c as Cursor;
  } catch {
    throw new ApiFailure(400, 'invalid_cursor', 'Activity cursor is invalid or expired. Refresh the list.');
  }
}
function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url');
}
function compare(a: {kind: Kind; id: string; at: string}, b: {kind: Kind; id: string; at: string}): number {
  if (a.at !== b.at) return a.at > b.at ? -1 : 1;
  const kindOrder = KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind);
  if (kindOrder) return kindOrder;
  return a.id > b.id ? -1 : a.id < b.id ? 1 : 0;
}
function timeWhere(field: string, kind: Kind, cursor: Cursor | null): Record<string, unknown> {
  if (!cursor) return {};
  const at = new Date(cursor.at);
  const anchor = new Date(cursor.anchor);
  const rank = KINDS.indexOf(kind);
  const boundaryRank = KINDS.indexOf(cursor.kind);
  const after = rank < boundaryRank
    ? { [field]: { lt: at } }
    : rank > boundaryRank
      ? { [field]: { lte: at } }
      : { OR: [{ [field]: { lt: at } }, { [field]: at, id: { lt: cursor.id } }] };
  return { AND: [{ [field]: { lte: anchor } }, after] };
}
type Candidate = { kind: Kind; id: string; at: string; convert: () => LedgerEntry };
function candidate(kind: Kind, id: string, at: Date, convert: () => LedgerEntry): Candidate {
  return { kind, id, at: at.toISOString(), convert };
}

/** Tenant/term are never taken from cursor filters; role checks live in both routes. */
export async function listLedgerPage(org: Organization, input: {
  cursor?: string | null; limit?: number; scope?: Scope;
} = {}): Promise<LedgerPage> {
  const scope = input.scope ?? 'all';
  if (scope !== 'all' && scope !== 'active') throw new ApiFailure(400, 'invalid', 'Invalid Activity scope.');
  const pageSize = input.limit ?? 50;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new ApiFailure(400, 'invalid', 'Activity page size must be between 1 and 100.');
  }
  const cursor = parseCursor(input.cursor, org, scope);
  const where = { organizationId: org.id,
    ...(scope === 'active' ? { academicYear: org.activeAy, term: org.activeTerm } : {}) };
  const take = pageSize + 1;

  // Each source returns at most pageSize+1 rows after the same keyset cursor.
  // A global page can contain at most pageSize rows from any individual source,
  // so merging these candidates yields the correct next combined page.
  const [collections, remittances, penalties, advances, cashier] = await Promise.all([
    prisma.collection.findMany({ where: { ...where, ...timeWhere('timestamp', 'collection', cursor) } as Prisma.CollectionWhereInput,
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }], take }),
    prisma.onlineRemittance.findMany({ where: { ...where, ...timeWhere('timestamp', 'online-remittance', cursor) } as Prisma.OnlineRemittanceWhereInput,
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }], take }),
    prisma.penalty.findMany({ where: { ...where, ...timeWhere('date', 'penalty', cursor) } as Prisma.PenaltyWhereInput,
      orderBy: [{ date: 'desc' }, { id: 'desc' }], take }),
    prisma.cashAdvance.findMany({ where: { ...where, ...timeWhere('dateIssued', 'advance', cursor) } as Prisma.CashAdvanceWhereInput,
      orderBy: [{ dateIssued: 'desc' }, { id: 'desc' }], take }),
    prisma.cashierRemittance.findMany({ where: { ...where, ...timeWhere('date', 'cashier-remittance', cursor) } as Prisma.CashierRemittanceWhereInput,
      orderBy: [{ date: 'desc' }, { id: 'desc' }], take }),
  ]);
  const candidates: Candidate[] = [
    ...collections.map(r => candidate('collection', r.id, r.timestamp, () => ({
      ...collectionEntry(r), academicYear: r.academicYear, term: r.term,
    }))),
    ...remittances.map(r => candidate('online-remittance', r.id, r.timestamp, () => ({
      ...remittanceEntry(r), academicYear: r.academicYear, term: r.term,
    }))),
    ...penalties.map(r => candidate('penalty', r.id, r.date, () => ({
      ...penaltyEntry(r), academicYear: r.academicYear, term: r.term,
    }))),
    ...advances.map(r => candidate('advance', r.id, r.dateIssued, () => ({
      id: r.id, kind: 'advance', title: r.requestor, reference: r.advanceId,
      subtitle: r.purpose || r.fundSource, amountCentavos: ledgerCentavos('advance', 'amountApproved', r.amountApproved),
      status: r.status, at: r.dateIssued.toISOString(), academicYear: r.academicYear, term: r.term,
    }))),
    ...cashier.map(r => candidate('cashier-remittance', r.id, r.date, () => ({
      id: r.id, kind: 'cashier-remittance', title: r.remittedBy,
      reference: r.cashierReceiptNo || r.remittanceId, subtitle: `${r.fundSource} · ${r.type}`,
      amountCentavos: ledgerCentavos('cashier-remittance', 'amount', r.amount),
      status: r.status, at: r.date.toISOString(), academicYear: r.academicYear, term: r.term,
    }))),
  ].sort(compare);

  const page = candidates.slice(0, pageSize);
  const hasMore = candidates.length > pageSize;
  const records = (() => {
    try { return page.map(p => p.convert()); }
    catch (e) {
      if (e instanceof LedgerReadIntegrityError) {
        console.warn('[api/mobile/ledger/page] exact-centavo review required', { category: e.source, field: e.field });
        throw new ApiFailure(422, 'financial_data_review',
          'This ledger contains an amount requiring financial review. No amount was rounded or changed.');
      }
      throw e;
    }
  })();
  // The first page pins the newest timestamp so newly arriving recent entries
  // cannot push subsequent pages around. Backdated inserts may still affect
  // a multi-request walk: refreshing restarts a new view of history.
  const anchor = cursor?.anchor ?? candidates[0]?.at;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last && anchor ? encodeCursor({
    v: 1, org: org.id, ay: org.activeAy, term: org.activeTerm, scope, anchor,
    at: last.at, kind: last.kind, id: last.id,
  }) : null;
  return { records, nextCursor, hasMore, scope, pageSize };
}
