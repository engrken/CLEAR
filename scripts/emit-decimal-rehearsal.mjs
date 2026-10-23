#!/usr/bin/env node
/**
 * Emit a reversible SQL rehearsal for converting CLEAR monetary Float columns
 * to NUMERIC(18,2). This tool generates SQL; it NEVER connects to a database.
 *
 * Output always ends in ROLLBACK. NEVER include this output in Prisma migrations
 * or deploy it on Production. Approval is required for any future cutover.
 */
import { readFileSync } from 'node:fs';
import { MONEY_COLUMNS } from '../lib/financial-column-catalog.mjs';

const quote = x => '"' + x.replaceAll('"','""') + '"';
const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const actual = [];
for (const [,model,body] of schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
  for (const line of body.split('\n')) {
    const match = line.trim().match(/^(\w+)\s+(?:Float|Decimal)\??(?:\s|$)/);
    if (match) actual.push(model + '.' + match[1]);
  }
}
const expected = Object.entries(MONEY_COLUMNS).flatMap(([table, columns]) =>
  columns.map(column => table + '.' + column));
const nonMoney = ['Penalty.hoursLate'];
const unique = values => [...new Set(values)].sort();
if (JSON.stringify(unique(actual)) !== JSON.stringify(unique([...expected,...nonMoney])) ||
    expected.length !== unique(expected).length) {
  process.stderr.write('STOP: currency catalog differs from Prisma schema. Review columns before rehearsing.\n');
  process.exit(1);
}

const sql = [
  '-- CLEAR MONEY: REHEARSAL ONLY. Never execute on live production.',
  '-- Snapshot and schema parity must be independently verified first.',
  '-- No changes survive this script: the final command is ROLLBACK.',
  'BEGIN;',
  "SET LOCAL lock_timeout = '2s';",
  "SET LOCAL statement_timeout = '30s';",
  'DO $preflight$',
  'BEGIN',
];
for (const [table, columns] of Object.entries(MONEY_COLUMNS)) {
  for (const column of columns) {
    const c = quote(column), t = quote(table);
    sql.push('  IF EXISTS (SELECT 1 FROM ' + t + ' WHERE');
    sql.push("    CASE WHEN " + c + "::text IN ('NaN','Infinity','-Infinity') THEN TRUE");
    sql.push('    WHEN ' + c + ' IS NULL THEN FALSE');
    sql.push('    ELSE ABS(' + c + '::numeric*100 - ROUND(' + c +
      '::numeric*100)) > 0.000001 OR ABS(' + c + ') >= 10000000000000000 END)');
    sql.push("  THEN RAISE EXCEPTION 'STOP: unsafe amount in " + table + '.' + column + "'; END IF;");
  }
}
sql.push('END');
sql.push('$preflight$;');
for (const [table, columns] of Object.entries(MONEY_COLUMNS)) {
  sql.push('ALTER TABLE ' + quote(table));
  sql.push('  ' + columns.map(c => 'ALTER COLUMN ' + quote(c) +
    ' TYPE NUMERIC(18,2) USING ' + quote(c) + '::numeric(18,2)').join(',\n  ') + ';');
}
sql.push('-- A real migration requires a synchronized Prisma Decimal app build.');
sql.push('-- This rehearsal never permanently modifies any data or schema.');
sql.push('ROLLBACK;');
process.stdout.write(sql.join('\n') + '\n');
