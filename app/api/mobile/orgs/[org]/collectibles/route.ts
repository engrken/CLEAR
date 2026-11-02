// Tenant-scoped, read-only collectibles overview for native Android.
// Cash adjustments, linking receipts and assessment changes stay on the web.
import { prisma } from '@/lib/prisma';
import { ApiFailure, handler, preflight } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { toCentavos } from '@/lib/mobile/serialize';

type Ctx = { params: Promise<{ org: string }> };
type Cursor = { v: 1; org: string; ay: string; term: string; id: string };
export const dynamic = 'force-dynamic';

function decodeCursor(raw: string | null, org: string, ay: string, term: string): string | null {
  if (raw === null) return null;
  if (raw.length < 8 || raw.length > 800 || !/^[A-Za-z0-9_-]+$/.test(raw)) {
    throw new ApiFailure(400, 'invalid_cursor', 'Refresh collectibles and retry.');
  }
  try {
    const value = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<Cursor>;
    if (Buffer.from(JSON.stringify(value)).toString('base64url') !== raw ||
        value.v !== 1 || value.org !== org || value.ay !== ay || value.term !== term ||
        typeof value.id !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(value.id)) {
      throw new Error('invalid');
    }
    return value.id;
  } catch {
    throw new ApiFailure(400, 'invalid_cursor', 'Refresh collectibles and retry.');
  }
}

export const GET = handler(async (req, { params }: Ctx) => {
  const { org: slug } = await params;
  const { org } = await requireMobileOfficer(req, slug, 'tab-collectibles');
  const q = new URL(req.url).searchParams;
  const count = q.get('limit') ?? '30';
  if (!/^[1-9]\d*$/.test(count) || Number(count) > 40) {
    throw new ApiFailure(400, 'invalid', 'Limit must be between 1 and 40.');
  }
  const limit = Number(count);
  const id = decodeCursor(q.get('cursor'), org.id, org.activeAy, org.activeTerm);
  const rows = await prisma.collectible.findMany({
    where: { organizationId: org.id, academicYear: org.activeAy, term: org.activeTerm,
      ...(id ? { id: { lt: id } } : {}) },
    select: { id: true, category: true, headcount: true, balanceDue: true, status: true },
    orderBy: { id: 'desc' }, take: limit + 1,
  });
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const hasMore = rows.length > limit;
  return {
    scope: 'active_period', ay: org.activeAy, term: org.activeTerm, hasMore,
    nextCursor: hasMore && last ? Buffer.from(JSON.stringify({
      v: 1, org: org.id, ay: org.activeAy, term: org.activeTerm, id: last.id,
    } satisfies Cursor)).toString('base64url') : null,
    records: page.map(row => {
      let balanceCentavos: number;
      try {
        if (row.balanceDue == null) throw new Error('missing amount');
        balanceCentavos = toCentavos(row.balanceDue);
      } catch {
        throw new ApiFailure(422, 'financial_data_review', 'A collectible amount requires review. No amount was changed.');
      }
      // Legacy status may contain encoded student identity markers. Do not
      // leak those markers in the broad mobile summary; the web has the audited
      // student-level assessment and receipt history.
      const status = row.status.split('|SID:')[0].trim();
      return {
        id: row.id, category: row.category, headcount: row.headcount,
        status: status || 'Outstanding', balanceCentavos,
      };
    }),
  };
});
export const OPTIONS = preflight;
