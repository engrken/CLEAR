import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

// Node 22 test loader: evaluate the actual shipped TypeScript helper, not a
// copied currency algorithm. Data-URL imports keep the test dependency-free
// while the Next.js production bundle continues using normal TS imports.
const precisionUrl = 'data:text/javascript,' +
  encodeURIComponent(stripTypeScriptTypes(read('lib/money-precision.ts'), { mode: 'strip' }));
const strippedLedger = stripTypeScriptTypes(read('lib/mobile/ledger-precision.ts'), { mode: 'strip' });
assert.ok(strippedLedger.includes("from '../money-precision';"));
const ledgerUrl = 'data:text/javascript,' +
  encodeURIComponent(strippedLedger.replace("from '../money-precision';", `from '${precisionUrl}';`));

const { ledgerCentavos, legacyPenaltyAssessedCentavos, LedgerReadIntegrityError } = await import(ledgerUrl);

test('ledger read accepts only exact centavos for all five financial categories', () => {
  for (const [category, field] of [
    ['collection', 'amountPaid'],
    ['online-remittance', 'amountPaid'],
    ['penalty', 'fineAmount'],
    ['advance', 'amountApproved'],
    ['cashier-remittance', 'amount'],
  ]) {
    assert.equal(ledgerCentavos(category, field, '150.05'), 15005);
    assert.equal(ledgerCentavos(category, field, { toString: () => '0.01' }), 1);
    assert.equal(ledgerCentavos(category, field, '-0.01'), -1);
    for (const invalid of ['150.005', 'NaN', 'Infinity', '1e-8', null, undefined]) {
      assert.throws(() => ledgerCentavos(category, field, invalid), error =>
        error instanceof LedgerReadIntegrityError &&
        error.source === category && error.field === field &&
        !error.message.includes('150.005') &&
        !error.message.includes('Infinity'));
    }
  }
});

test('the legacy penalty time conversion matches web nearest-cent business rules', () => {
  assert.equal(legacyPenaltyAssessedCentavos(1 / 60, '50.00'), 83);
  assert.equal(legacyPenaltyAssessedCentavos(2 / 60, '50.00'), 167);
  assert.equal(legacyPenaltyAssessedCentavos(5 / 60, '50.00'), 417);
  assert.equal(legacyPenaltyAssessedCentavos(1, '50.00'), 5000);
  assert.equal(legacyPenaltyAssessedCentavos(0, '50.00'), 0);
  assert.equal(legacyPenaltyAssessedCentavos(2 / 60, { toString: () => '50.00' }), 167);
  assert.throws(() => legacyPenaltyAssessedCentavos(2 / 60, '50.005'), LedgerReadIntegrityError);
  for (const hours of [-1, NaN, Infinity, 0.0001, 1e16]) {
    assert.throws(() => legacyPenaltyAssessedCentavos(hours, '50.00'), LedgerReadIntegrityError);
  }
});

test('ledger read never fabricates zero or silently rounds sub-cent amounts', () => {
  const helper = read('lib/mobile/ledger-precision.ts');
  const data = read('lib/mobile/data.ts');
  assert.match(helper, /return moneyCentavos\(value\)/);
  assert.doesNotMatch(helper, /Math\.floor/);
  for (const label of [
    "ledgerCentavos('collection', 'amountPaid'",
    "ledgerCentavos('collection', 'balanceDue'",
    "ledgerCentavos('online-remittance', 'amountPaid'",
    "ledgerCentavos('penalty', 'fineAmount'",
    "ledgerCentavos('penalty', 'assessedAmount'",
    "ledgerCentavos('advance', 'amountApproved'",
    "ledgerCentavos('cashier-remittance', 'amount'",
  ]) assert.ok(data.includes(label), 'strict money conversion missing: ' + label);
  assert.match(data, /legacyPenaltyAssessedCentavos\(p\.hoursLate, p\.ratePerHour\)/);
  // A legacy cash-only flat fee has no hours/rate-based original assessment.
  // The API must omit the optional field rather than falsely report ₱0.00.
  assert.match(data, /p\.penaltyType === 'LATE_FEE'\s*\? \{\}/);
  assert.match(data, /error instanceof LedgerReadIntegrityError/);
  assert.match(data, /new ApiFailure\(422, 'financial_data_review'/);
  assert.match(data, /No amount was rounded or changed/);
  assert.doesNotMatch(data, /amountCentavos:\s*(?:0|null|undefined)\s*[,}]/);
  assert.doesNotMatch(data, /prisma\.(?:collection|penalty|cashAdvance|cashierRemittance)\.(?:update|upsert|delete|create)\(/);
});

test('read-only original global and officer authorization remains enforced', () => {
  const global = read('app/api/mobile/global/orgs/[org]/ledger/route.ts');
  const officer = read('app/api/mobile/orgs/[org]/ledger/route.ts');
  assert.match(global, /requireGlobalMobileTenant\(req, slug\)/);
  assert.match(officer, /requireMobileOfficer\(req, slug, 'tab-overview'\)/);
  assert.match(global, /listLedger\(org, \{ limit: 100 \}\)/);
  assert.doesNotMatch(global + officer, /export const POST|export const PUT|export const PATCH|export const DELETE/);
});
