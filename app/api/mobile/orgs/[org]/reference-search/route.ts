// Read-only receipt/void audit search, never a payment or void command.
// Results are bounded with fail-closed caps; an incomplete official-receipt
// group must NEVER be displayed as a complete financial total.
import { prisma } from '@/lib/prisma';
import { ApiFailure, handler, preflight } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { toCentavos } from '@/lib/mobile/serialize';
import { baseOfficialReceiptNumber, buildIssuedReceipts } from '@/app/department/[department]/(protected)/collections/history/receipt-grouping';
type Ctx = { params: Promise<{ org: string }> };
export const dynamic = 'force-dynamic';

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  const paramsQuery = new URL(req.url).searchParams;
  const kind = paramsQuery.get('kind');
  if (kind !== 'receipts' && kind !== 'void') throw new ApiFailure(400, 'invalid', 'Specify a valid reference search category.');
  const q = String(paramsQuery.get('q') ?? '').trim();
  if (q.length < 3 || q.length > 80) throw new ApiFailure(400, 'invalid', 'Search using 3–80 characters.');
  const { org } = await requireMobileOfficer(req, slug, kind === 'void' ? 'tab-void' : 'tab-payment');
  if (kind === 'void') {
    // VoidTransaction has no AY/term. Explicitly identify tenant-wide audit.
    const rows = await prisma.voidTransaction.findMany({
      where: { organizationId: org.id, OR: [
        { referenceId: { contains: q, mode: 'insensitive' } },
        { transactionType: { contains: q, mode: 'insensitive' } },
        { reason: { contains: q, mode: 'insensitive' } },
      ] },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: 51,
      select: { id: true, referenceId: true, transactionType: true, reason: true, date: true, amount: true },
    });
    if (rows.length > 50) throw new ApiFailure(422, 'narrow_search', 'Too many void records. Search a more specific reference.');
    return { kind, scope: 'tenant_all_periods', query: q,
      records: rows.map(r => ({
        id: r.id, reference: r.referenceId, kind: r.transactionType,
        reason: r.reason.slice(0, 160), when: r.date.toISOString(),
        amountCentavos: toCentavos(r.amount),
      })),
    };
  }
  const period = { organizationId: org.id, academicYear: org.activeAy, term: org.activeTerm };
  // Prefilter indexed tenant/period data by OR, name, student number and item.
  // Broad queries explicitly fail rather than returning a misleading subset.
  const matching = await prisma.collection.findMany({
    where: { ...period, OR: [
      { orNumber: { contains: q, mode: 'insensitive' } },
      { studentName: { contains: q, mode: 'insensitive' } },
      { itemDescription: { contains: q, mode: 'insensitive' } },
      { category: { contains: q, mode: 'insensitive' } },
      { student: { is: { organizationId: org.id,
        studentId: { contains: q, mode: 'insensitive' } } } },
    ] },
    select: { orNumber: true },
    take: 121,
  });
  if (matching.length > 120) throw new ApiFailure(422, 'narrow_search', 'Too many matching allocations. Enter a more specific OR or student number.');
  const bases = [...new Set(matching.map(row => baseOfficialReceiptNumber(row.orNumber)))];
  if (bases.length > 40) throw new ApiFailure(422, 'narrow_search', 'Too many receipt groups. Narrow the reference.');
  if (!bases.length) return { kind, scope: 'active_period', ay: org.activeAy, term: org.activeTerm, query: q, records: [] };

  // Never page allocation lines: legacy packages reuse base OR and newer
  // package lines use -P02/-P03. Use the SAME source grouping as web history.
  const allocations = await prisma.collection.findMany({
    where: { ...period, OR: bases.flatMap(base => [
      { orNumber: { equals: base, mode: 'insensitive' as const } },
      { orNumber: { startsWith: base + '-P', mode: 'insensitive' as const } },
    ]) },
    select: {
      id: true, orNumber: true, studentId: true, studentName: true,
      student: { select: { studentId: true } },
      academicYear: true, term: true, date: true, timestamp: true,
      encodedBy: true, category: true, itemDescription: true,
      paymentType: true, status: true, amountPaid: true,
    },
    orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
    take: 1001,
  });
  if (allocations.length > 1000) throw new ApiFailure(422, 'narrow_search', 'Receipt contains too many allocations. Use secure web Receipt History.');
  const needle = q.toLowerCase();
  const records = buildIssuedReceipts(allocations)
    .filter(r => [r.orNumber, r.studentName, r.studentNumber, ...r.descriptions, ...r.categories]
      .some(value => value.toLowerCase().includes(needle)))
    .map(r => ({
      id: r.key, reference: r.orNumber, name: r.studentName,
      studentNumber: r.studentNumber, when: r.timestamp, status: r.status,
      amountPesos: r.total, inconsistent: r.inconsistencyReason,
      allocationCount: r.count, description: r.description,
    }));
  return { kind, scope: 'active_period', ay: org.activeAy, term: org.activeTerm, query: q, records };
});
export const OPTIONS = preflight;
