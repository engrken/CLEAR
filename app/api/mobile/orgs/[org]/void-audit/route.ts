// GET-only projection of the canonical web Void Center audit. No void action is
// implemented here. Do not expose cross-tenant results or unbounded scans.
import { prisma } from '@/lib/prisma';
import { ApiFailure, handler, preflight } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { toCentavos } from '@/lib/mobile/serialize';

type Ctx = { params: Promise<{ org: string }> };
type Cursor = { v: 1; org: string; at: string; id: string };
export const dynamic = 'force-dynamic';

function readCursor(raw: string | null, org: string): Cursor | null {
  if (raw === null) return null;
  if (!raw || raw.length > 800 || !/^[A-Za-z0-9_-]+$/.test(raw)) {
    throw new ApiFailure(400, 'invalid_cursor', 'Void audit cursor is invalid. Refresh the list.');
  }
  try {
    const value = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<Cursor>;
    if (Buffer.from(JSON.stringify(value)).toString('base64url') !== raw ||
        value.v !== 1 || value.org !== org ||
        typeof value.at !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.at) ||
        !Number.isFinite(Date.parse(value.at)) ||
        new Date(value.at).toISOString() !== value.at ||
        typeof value.id !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(value.id)) {
      throw Error('Malformed cursor');
    }
    return value as Cursor;
  } catch {
    throw new ApiFailure(400, 'invalid_cursor', 'Void audit cursor is invalid or expired. Refresh the list.');
  }
}

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  // Do not perform a VoidTransaction read until tenant membership AND the
  // canonical web tab-void grant have been revalidated for the active session.
  const { org } = await requireMobileOfficer(req, slug, 'tab-void');
  const query = new URL(req.url).searchParams;
  const rawLimit = query.get('limit') ?? '30';
  if (!/^[1-9]\d*$/.test(rawLimit) || Number(rawLimit) > 50) {
    throw new ApiFailure(400, 'invalid', 'Void audit page size must be between 1 and 50.');
  }
  const limit = Number(rawLimit);
  const cursor = readCursor(query.get('cursor'), org.id);
  const where = { organizationId: org.id,
    ...(cursor ? { OR: [
      { date: { lt: new Date(cursor.at) } },
      { date: new Date(cursor.at), id: { lt: cursor.id } },
    ] } : {}),
  };
  const rows = await prisma.voidTransaction.findMany({
    where, orderBy: [{ date: 'desc' }, { id: 'desc' }], take: limit + 1,
    select: { id: true, referenceId: true, transactionType: true,
      reason: true, date: true, amount: true },
  });
  const page = rows.slice(0, limit);
  const records = page.map(r => {
    let amountCentavos: number;
    try { amountCentavos = toCentavos(r.amount); }
    catch { throw new ApiFailure(422, 'financial_data_review', 'A void amount requires financial review. No data was changed.'); }
    return { id: r.id, reference: r.referenceId, kind: r.transactionType,
      reason: (r.reason ?? '').slice(0, 160),
      when: r.date.toISOString(), amountCentavos };
  });
  const hasMore = rows.length > limit;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? Buffer.from(JSON.stringify({
    v: 1, org: org.id, at: last.date.toISOString(), id: last.id,
  } satisfies Cursor)).toString('base64url') : null;
  return { scope: 'tenant_all_periods', records, hasMore, nextCursor, pageSize: limit };
});
export const OPTIONS = preflight;
