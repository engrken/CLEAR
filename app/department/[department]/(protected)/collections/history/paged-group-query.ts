import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { baseOfficialReceiptNumber, buildIssuedReceipts, type IssuedReceipt } from './receipt-grouping';

/**
 * Optional, read-only SQL receipt-GROUP pagination. Never paginate collection
 * allocation lines independently: an OR may have several legacy or -Pnn rows.
 * A repeatable-read snapshot ensures count, page and allocations agree even
 * while the authoritative web cashier is posting a new receipt.
 */
export type PagedReceiptGroups = {
  receipts: IssuedReceipt[];
  categories: string[];
  paymentTypes: string[];
  page: number;
  maxPage: number;
  total: number;
  allocationCount: number;
  receiptGroupCount: number;
};

export async function loadDefaultReceiptGroups(input: {
  organizationId: string;
  ay: string;
  term: string;
  requestedPage: number;
  pageSize: number;
}): Promise<PagedReceiptGroups | null> {
  const { organizationId, ay, term, requestedPage, pageSize } = input;
  if (!organizationId || !ay || !term || !Number.isSafeInteger(pageSize) ||
      pageSize < 1 || pageSize > 100 || !Number.isSafeInteger(requestedPage) ||
      requestedPage < 1) return null;

  return prisma.$transaction(async tx => {
    const totals = await tx.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*)::bigint AS total FROM (
        SELECT 1 FROM "Collection"
        WHERE "organizationId" = ${organizationId}
          AND "academicYear" = ${ay} AND "term" = ${term}
        GROUP BY UPPER(REGEXP_REPLACE(BTRIM("orNumber"), '-P[0-9]+$', '', 'i'))
      ) AS receipt_groups
    `;
    const total = Number(totals[0]?.total ?? 0);
    if (!Number.isSafeInteger(total) || total < 0) return null;
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, maxPage);
    const offset = (page - 1) * pageSize;

    const candidateBases = await tx.$queryRaw<Array<{ base: string }>>`
      SELECT UPPER(REGEXP_REPLACE(BTRIM("orNumber"), '-P[0-9]+$', '', 'i')) AS base
      FROM "Collection"
      WHERE "organizationId" = ${organizationId}
        AND "academicYear" = ${ay} AND "term" = ${term}
      GROUP BY 1
      ORDER BY MAX("timestamp") DESC, base ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    const bases = candidateBases.map(row => row.base);
    if (bases.length !== (total === 0 ? 0 : Math.min(pageSize, total - offset))) return null;
    const wanted = new Set(bases);

    const lines = bases.length ? await tx.collection.findMany({
      where: {
        organizationId, academicYear: ay, term,
        OR: bases.flatMap(base => [
          { orNumber: { equals: base, mode: 'insensitive' as const } },
          { orNumber: { startsWith: base + '-P', mode: 'insensitive' as const } },
        ]),
      },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      select: {
        id: true, orNumber: true, studentId: true, studentName: true,
        student: { select: { studentId: true } },
        academicYear: true, term: true, date: true, timestamp: true,
        encodedBy: true, category: true, itemDescription: true,
        paymentType: true, status: true, amountPaid: true,
      },
    }) : [];
    // The prefix lookup above may match malformed "-Pxyz" rows. Never let
    // such allocations contaminate an issued receipt group.
    const exactLines = lines.filter(line =>
      wanted.has(baseOfficialReceiptNumber(line.orNumber)));
    const receipts = buildIssuedReceipts(exactLines);
    if (receipts.length !== bases.length ||
        receipts.some(receipt => !wanted.has(receipt.orNumber))) return null;

    // Populate the existing dropdowns for the whole authorized academic
    // period without returning other students' or receipts' financial rows.
    const values = await tx.$queryRaw<Array<{
      categories: string[] | null; paymentTypes: string[] | null;
    }>>`
      SELECT ARRAY_REMOVE(ARRAY_AGG(DISTINCT "category"), NULL) AS categories,
             ARRAY_REMOVE(ARRAY_AGG(DISTINCT "paymentType"), NULL) AS "paymentTypes"
      FROM "Collection"
      WHERE "organizationId" = ${organizationId}
        AND "academicYear" = ${ay} AND "term" = ${term}
    `;
    const categories = (values[0]?.categories ?? []).filter(Boolean).sort();
    const paymentTypes = (values[0]?.paymentTypes ?? []).filter(Boolean).sort();
    return {
      receipts, categories, paymentTypes, page, maxPage, total,
      allocationCount: exactLines.length, receiptGroupCount: receipts.length,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    maxWait: 5000, timeout: 15000 });
}
