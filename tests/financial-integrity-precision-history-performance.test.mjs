import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allocateLegacyPackageCents } from '../lib/legacy-package-allocation.ts';
import { buildIssuedReceipts } from '../app/department/[department]/(protected)/collections/history/receipt-grouping.ts';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const cents = (amounts) => amounts.map(value => Math.round(value * 100));

test('legacy single-receipt allocations preserve every centavo with stable ties', () => {
  assert.deepEqual(cents(allocateLegacyPackageCents(0.01, [1, 1, 1])), [1, 0, 0]);
  assert.deepEqual(cents(allocateLegacyPackageCents(0.02, [1, 1, 1])), [1, 1, 0]);
  assert.deepEqual(cents(allocateLegacyPackageCents(-0.02, [1, 1, 1])), [-1, -1, 0]);
  for (const amount of [0, 0.01, 0.05, 12.31, 450, 650.13]) {
    const portions = allocateLegacyPackageCents(amount, [50, 100, 150, 350]);
    assert.equal(cents(portions).reduce((sum, value) => sum + value, 0),
      Math.round(amount * 100));
  }
  assert.deepEqual(allocateLegacyPackageCents(12.34, [0, 0]), []);
  assert.throws(() => allocateLegacyPackageCents(Infinity, [1, 1]));
  assert.throws(() => allocateLegacyPackageCents(1, [-2, 1]));
});

test('web and Android financial engines use the same centavo distribution and minimal student projection', () => {
  for (const path of ['app/department/[department]/actions.ts', 'lib/financials.ts']) {
    const source = read(path);
    assert.match(source, /import \{ allocateLegacyPackageCents \}/, path);
    assert.match(source, /const allocated = allocateLegacyPackageCents\(/, path);
    assert.doesNotMatch(source, /\(Number\(pi\.rate\) \/ pkgTotalRate\) \* amt/, path);
    assert.match(source, /select: \{ id: true, studentId: true, fullName: true \}/, path);
    assert.match(source, /orderBy: \{ id: 'asc' \}/, path);
  }
});

test('historical receipt review detects sub-cent entries without editing source lines', () => {
  const base = {
    id: 'line-1', orNumber: '26-101', studentId: null,
    studentName: 'Test Student', student: null, academicYear: 'A.Y. 2025 - 2026',
    term: '1st Sem', date: '2025-10-01T00:00:00.000Z',
    timestamp: '2025-10-01T00:00:00.000Z', encodedBy: null,
    category: 'Fees', itemDescription: 'Package', paymentType: 'Cash',
    status: 'Valid', amountPaid: 1,
  };
  const original = { ...base, amountPaid: 1.005 };
  const suspicious = buildIssuedReceipts([original]);
  assert.equal(suspicious[0].status, 'Inconsistent');
  assert.match(suspicious[0].inconsistencyReason, /Sub-cent or unsafe monetary precision/);
  assert.equal(original.amountPaid, 1.005);
  assert.equal(suspicious[0].total, null, 'unsafe historical precision must not be rounded into a displayed total');
  const normal = buildIssuedReceipts([
    { ...base, amountPaid: 100 },
    { ...base, id: 'line-2', orNumber: '26-101-P02', itemDescription: 'Other fund', amountPaid: 50 },
  ]);
  assert.equal(normal.length, 1);
  assert.equal(normal[0].status, 'Valid');
  assert.equal(normal[0].total, 150);
});

test('historic arrears reader retains student marker and tenant isolation while limiting rows', () => {
  const source = read('lib/student-arrears.ts');
  assert.ok(source.includes('organizationId, balanceDue: { gt: 0 }, status: { contains: "|SID:" }'));
  assert.match(source, /decodeStudentDue\(due\.status\)/);
  assert.match(source, /olderThan\(due\.academicYear, due\.term/);
});

test('receipt lookup narrows exact OR on the database without losing package rows', () => {
  const source = read('app/department/[department]/(protected)/collections/history/page.tsx');
  assert.match(source, /\.\.\.\(exactOr \? \{ OR:/);
  assert.match(source, /orNumber: \{ startsWith:/);
  assert.match(source, /buildIssuedReceipts\(allocationLines(?:\.map\(row => \(\{ \.\.\.row, amountPaid: moneyNumber\(row\.amountPaid\) \}\)\))?\)/);
  assert.match(source, /requireTabAccess\("tab-payment", slug\)/);
});
