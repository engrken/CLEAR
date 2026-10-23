#!/usr/bin/env node
/* Aggregate-only finance audit and isolated SQL microbenchmark. NO database writes.
 * Audit:     CLEAR_DB_AUDIT_SCOPE=isolated node scripts/finance-readonly-audit.mjs
 * Benchmark: CLEAR_DB_AUDIT_SCOPE=isolated node scripts/finance-readonly-audit.mjs --benchmark
 * Production aggregate audit requires explicit CLEAR_DB_AUDIT_SCOPE=prod-readonly.
 * NEVER prints students, official receipt numbers, balances, or credentials.
 */
import { Prisma, PrismaClient } from '@prisma/client';

import { MONEY_COLUMNS } from '../lib/financial-column-catalog.mjs';

// Penalty.hoursLate is a time measurement; never convert it as currency.

const quote = id => {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(id)) throw Error('Invalid identifier.');
  return '"' + id + '"';
};
const statements = Object.entries(MONEY_COLUMNS).flatMap(([table, fields]) =>
  fields.map(column => ({ table, column })));

const historicalSQL = [
  'WITH groups AS (',
  'SELECT "organizationId" AS org, REGEXP_REPLACE(UPPER(BTRIM("orNumber")),',
  "'-P[0-9]+$', '') AS base_or,",
  '"academicYear" AS ay, "term", COUNT(*) AS allocation_lines,',
  'COUNT(DISTINCT CASE WHEN "studentId" IS NOT NULL THEN ',
  "'id:'||\"studentId\" ELSE 'name:'||LOWER(BTRIM(\"studentName\")) END) AS distinct_refs,",
  'BOOL_OR(UPPER(COALESCE("status",\'\')||\' \'||COALESCE("paymentType",\'\'))',
  "~ '(VOID|CANCEL|REJECT)') AS void_row,",
  'BOOL_OR(UPPER(COALESCE("status",\'\')||\' \'||COALESCE("paymentType",\'\'))',
  "!~ '(VOID|CANCEL|REJECT)') AS active_row",
  'FROM "Collection" GROUP BY "organizationId",',
  "REGEXP_REPLACE(UPPER(BTRIM(\"orNumber\")), '-P[0-9]+$', ''), \"academicYear\", \"term\"",
  '), reused AS (SELECT org, base_or, COUNT(*) AS periods FROM groups GROUP BY org, base_or)',
  'SELECT (SELECT COUNT(*)::int FROM "Collection") AS allocation_rows,',
  '(SELECT COUNT(*)::int FROM groups) AS receipt_groups,',
  '(SELECT COUNT(*)::int FROM groups WHERE allocation_lines>1) AS multiple_allocation_groups,',
  '(SELECT COUNT(*)::int FROM groups WHERE distinct_refs>1) AS conflicting_student_reference_groups,',
  '(SELECT COUNT(*)::int FROM groups WHERE void_row AND active_row) AS mixed_void_groups,',
  '(SELECT COUNT(*)::int FROM reused WHERE periods>1) AS reused_or_across_periods,',
  '(SELECT COUNT(*)::int FROM "Collection" WHERE "studentId" IS NULL) AS unlinked_legacy_allocation_rows,',
  '(SELECT COUNT(*)::int FROM "Penalty" WHERE "studentId" IS NULL AND "fineAmount">0',
  "AND UPPER(COALESCE(\"status\",'')) !~ '(VOID|CANCEL|SETTLED)') AS unlinked_open_penalties,",
  '(SELECT COUNT(*)::int FROM "Collectible" WHERE "balanceDue">0',
  "AND \"status\" LIKE '%|SID:%') AS explicit_student_dues,",
  '(SELECT COUNT(*)::int FROM "Collectible" WHERE "balanceDue">0',
  "AND COALESCE(\"status\",'') NOT LIKE '%|SID:%') AS unlinked_organization_dues,",
  '(SELECT COUNT(*)::int FROM "ArrearPaymentLink") AS existing_arrear_links',
].join(' ');

function moneyAuditSQL(table, column) {
  const c = quote(column), valid = c + " IS NOT NULL AND " + c +
    "::text NOT IN ('NaN','Infinity','-Infinity')";
  return 'SELECT COUNT(*)::int AS rows, COUNT(*) FILTER (WHERE ' + c +
    ' IS NULL)::int AS null_rows, COUNT(*) FILTER (WHERE ' + c +
    "::text IN ('NaN','Infinity','-Infinity'))::int AS nonfinite_rows, " +
    'COUNT(*) FILTER (WHERE ' + valid + ' AND ABS(' + c +
    '::numeric*100-ROUND(' + c + '::numeric*100))>0.000001)::int AS subcent_rows, ' +
    'COUNT(*) FILTER (WHERE ' + valid + ' AND ABS(' + c +
    ')>=10000000000000000)::int AS over_decimal18_rows FROM ' + quote(table);
}

export const benchmarkSQL = Object.freeze({
  receipt_history_current_period: [
    'SELECT c."id", c."orNumber", c."timestamp", c."amountPaid"',
    'FROM "Collection" c JOIN "Organization" o ON o."id"=c."organizationId"',
    'WHERE c."academicYear"=o."activeAy" AND c."term"=o."activeTerm"',
    'ORDER BY c."timestamp" DESC, c."id" DESC',
  ].join(' '),
  student_roster_current_period: [
    'SELECT s."id", s."studentId", s."fullName", s."yearLevel"',
    'FROM "Student" s JOIN "Organization" o ON o."id"=s."organizationId"',
    'WHERE EXISTS (SELECT 1 FROM "Enrollment" e WHERE e."studentId"=s."id"',
    'AND e."organizationId"=s."organizationId" AND e."academicYear"=o."activeAy"',
    'AND e."term"=o."activeTerm" AND e."enrollmentStatus"=\'Enrolled\')',
    'ORDER BY s."fullName" LIMIT 10',
  ].join(' '),
  historical_student_due_candidates: [
    'SELECT d."id", d."status", d."balanceDue" FROM "Collectible" d',
    "WHERE d.\"balanceDue\">0 AND d.\"status\" LIKE '%|SID:%'",
  ].join(' '),
});

const round = value => Math.round(Number(value) * 1000) / 1000;
function percentile(array, pct) {
  const sorted = [...array].sort((a, b) => a - b);
  return round(sorted[Math.max(0, Math.ceil(sorted.length * pct) - 1)]);
}

async function audit(tx) {
  const fields = [];
  for (const { table, column } of statements) {
    // Only immutable source-whitelisted identifiers enter the query.
    const [counts] = await tx.$queryRawUnsafe(moneyAuditSQL(table, column));
    fields.push({ field: table + '.' + column, ...counts });
  }
  const [history] = await tx.$queryRawUnsafe(historicalSQL);
  return { note: 'Aggregate read-only audit; never historical remediation', moneyFieldCount: fields.length, fields, history };
}

async function benchmark(tx) {
  const results = [];
  for (const [query, sql] of Object.entries(benchmarkSQL)) {
    const samples = [];
    for (let n = 0; n < 7; n++) {
      // Safe SELECT under READ ONLY transaction; EXPLAIN never exposes rows.
      const rows = await tx.$queryRawUnsafe('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' + sql);
      const plan = rows[0]?.['QUERY PLAN']?.[0];
      if (!Number.isFinite(Number(plan?.['Execution Time']))) throw Error('Unexpected execution plan.');
      if (n > 0) samples.push(Number(plan['Execution Time']));
    }
    results.push({ query, samples: samples.length, unit: 'db_execution_ms',
      p50: percentile(samples, .5), p95: percentile(samples, .95),
      min: round(Math.min(...samples)), max: round(Math.max(...samples)) });
  }
  return { note: 'Isolated staging SQL only: not website or mobile end-to-end p95', results };
}

async function main() {
  const mode = process.argv[2] || '--audit';
  const scope = process.env.CLEAR_DB_AUDIT_SCOPE || '';
  if (!['--audit', '--benchmark'].includes(mode)) throw Error('Unknown mode.');
  if (!['isolated', 'prod-readonly'].includes(scope)) throw Error('Explicit database audit scope required.');
  if (mode === '--benchmark' && scope !== 'isolated') throw Error('Benchmark only on isolated database.');
  if (!process.env.DATABASE_URL) throw Error('DATABASE_URL is required.');
  const client = new PrismaClient();
  try {
    const result = await client.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      return mode === '--benchmark' ? benchmark(tx) : audit(tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60000 });
    process.stdout.write(JSON.stringify({ scope, ...result }, null, 2) + '\n');
  } finally {
    await client.$disconnect();
  }
}
main().catch(() => {
  // Never echo database URLs, student identities, or row contents.
  process.stderr.write('Read-only finance audit failed; verify database scope and schema.\n');
  process.exitCode = 1;
});
