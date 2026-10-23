import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MONEY_COLUMNS } from '../lib/financial-column-catalog.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(path.join(root,file), 'utf8');
const moneyCount = Object.values(MONEY_COLUMNS).reduce((n, columns) => n + columns.length, 0);

test('catalog maps every Prisma monetary Float exactly once and excludes hoursLate', () => {
  assert.equal(moneyCount, 26);
  const schema = read('prisma/schema.prisma');
  const actual = [];
  for (const [,model,body] of schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
    for (const line of body.split('\n')) {
      const match = line.trim().match(/^(\w+)\s+Float\??(?:\s|$)/);
      if (match) actual.push(model + '.' + match[1]);
    }
  }
  const expected = Object.entries(MONEY_COLUMNS).flatMap(([t, cols]) =>
    cols.map(c => t + '.' + c)).concat('Penalty.hoursLate');
  assert.deepEqual(actual.sort(), expected.sort());
});

test('generated Decimal rehearsal validates data and always rolls back', () => {
  const sql = execFileSync(process.execPath, ['scripts/emit-decimal-rehearsal.mjs'],
    { cwd: root, encoding: 'utf8' });
  assert.match(sql, /^-- CLEAR MONEY: REHEARSAL ONLY/);
  assert.match(sql, /SET LOCAL lock_timeout = '2s'/);
  assert.match(sql, /STOP: unsafe amount in Collection.amountPaid/);
  assert.equal((sql.match(/ALTER COLUMN "(\w+)" TYPE NUMERIC\(18,2\)/g)||[]).length, moneyCount);
  assert.doesNotMatch(sql, /ALTER COLUMN "hoursLate"/);
  assert.doesNotMatch(sql, /SET NOT NULL/);
  assert.match(sql, /\bROLLBACK;\s*$/);
  assert.doesNotMatch(sql, /\bCOMMIT\b/);
});

test('audit scripts cannot benchmark Production and enforce read-only transactions', () => {
  const source = read('scripts/finance-readonly-audit.mjs');
  assert.match(source, /SET TRANSACTION READ ONLY/);
  assert.match(source, /RepeatableRead/);
  assert.match(source, /mode === '--benchmark' && scope !== 'isolated'/);
  assert.match(source, /history,/);
  assert.match(source, /EXPLAIN \(ANALYZE, BUFFERS, FORMAT JSON\)/);
  assert.doesNotMatch(source, /\b(?:updateMany|deleteMany|createMany|ALTER TABLE|TRUNCATE TABLE)\s*\(/i);
  const child = spawnSync(process.execPath, ['scripts/finance-readonly-audit.mjs', '--benchmark'], {
    cwd: root, encoding: 'utf8',
    env: { ...process.env, CLEAR_DB_AUDIT_SCOPE: 'prod-readonly', DATABASE_URL: '' },
  });
  assert.notEqual(child.status, 0, 'Production benchmarking must be rejected');
  assert.doesNotMatch(child.stderr, /postgresql:\/\/|studentName|orNumber/);
});

test('history audit aggregates legacy anomalies without listing students or receipt IDs', () => {
  const source = read('scripts/finance-readonly-audit.mjs');
  assert.match(source, /multiple_allocation_groups/);
  assert.match(source, /conflicting_student_reference_groups/);
  assert.match(source, /unlinked_legacy_allocation_rows/);
  assert.match(source, /unlinked_organization_dues/);
  assert.match(source, /reused_or_across_periods/);
  assert.match(source, /existing_arrear_links/);
  assert.match(source, /SELECT COUNT\(\*\)::int/);
});
