import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('additive mobile finance endpoint requires tenant/role before reading records', () => {
  const source = read('app/api/mobile/orgs/[org]/finance-review/route.ts');
  const gate = source.indexOf('await requireMobileOfficer(req, slug, PERMISSION[mode])');
  assert.ok(gate > 0);
  for (const [kind, grant] of Object.entries({
    penalties: 'tab-penalties', advances: 'tab-advances',
    liquidations: 'tab-audit', collections: 'tab-payment',
  })) assert.ok(source.includes(kind + ": '" + grant + "'"));
  for (const op of ['prisma.penalty.findMany','prisma.cashAdvance.findMany',
    'prisma.audit.findMany','prisma.collection.findMany'])
    assert.ok(source.indexOf(op) > gate, op + ' must follow authorization');
  assert.match(source, /organizationId: org\.id, academicYear: org\.activeAy, term: org\.activeTerm/);
  assert.match(source, /PAGE_LIMIT = 40/);
  assert.match(source, /return \{/);
  assert.doesNotMatch(source, /export const (POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(source, /prisma\.\w+\.(?:create|update|delete|upsert)\(/);
});

test('both mobile Activity paginated routes authorize tenant and reporting scope', () => {
  const officer = read('app/api/mobile/orgs/[org]/ledger/page/route.ts');
  const global = read('app/api/mobile/global/orgs/[org]/ledger/page/route.ts');
  assert.match(officer, /requireMobileOfficer\(req, slug, 'tab-overview'\)/);
  assert.match(officer, /hasTabAccess\(officer\.role, officer\.allowedTabs, 'tab-reports'\)/);
  assert.match(global, /requireGlobalMobileTenant\(req, slug\)/);
  for (const source of [officer,global]) {
    assert.match(source, /listLedgerPage\(org/);
    assert.doesNotMatch(source, /export const (POST|PUT|PATCH|DELETE)/);
  }
  for (const path of ['app/api/mobile/orgs/[org]/ledger/route.ts',
    'app/api/mobile/global/orgs/[org]/ledger/route.ts']) {
    const original = read(path);
    assert.match(original, /listLedger\(/);
    assert.doesNotMatch(original, /listLedgerPage\(/);
  }
});

test('server Activity page keyset limits and precision failures are explicit', () => {
  const source = read('lib/mobile/ledger-page.ts');
  assert.match(source, /pageSize > 100/);
  assert.match(source, /id: \{ lt: cursor\.id \}/);
  assert.match(source, /financial_data_review/);
  assert.match(source, /LedgerReadIntegrityError/);
  assert.match(source, /organizationId: org\.id/);
  assert.doesNotMatch(source, /\.skip\(/);
  assert.doesNotMatch(source, /prisma\.\w+\.(?:create|update|delete|upsert)\(/);
});
