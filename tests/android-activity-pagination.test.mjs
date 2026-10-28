import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('published Android v1.2.4 array ledger contract remains unchanged', () => {
  for (const path of [
    'app/api/mobile/global/orgs/[org]/ledger/route.ts',
    'app/api/mobile/orgs/[org]/ledger/route.ts',
  ]) {
    const source = read(path);
    assert.match(source, /listLedger\(/);
    assert.doesNotMatch(source, /listLedgerPage\(/);
  }
});
test('all-period paginated ledger enforces global/officer auth on every new GET', () => {
  const global = read('app/api/mobile/global/orgs/[org]/ledger/page/route.ts');
  const officer = read('app/api/mobile/orgs/[org]/ledger/page/route.ts');
  assert.match(global, /requireGlobalMobileTenant\(req, slug\)/);
  assert.match(officer, /requireMobileOfficer\(req, slug, 'tab-overview'\)/);
  assert.match(officer, /hasTabAccess\(officer\.role, officer\.allowedTabs, 'tab-reports'\)/);
  for (const route of [global, officer]) {
    assert.match(route, /listLedgerPage\(org/);
    assert.doesNotMatch(route, /export const (POST|PUT|PATCH|DELETE)/);
  }
});
test('keyset pagination is capped, ties are deterministic and invalid cents fail closed', () => {
  const code = read('lib/mobile/ledger-page.ts');
  assert.match(code, /pageSize > 100/);
  assert.match(code, /id: \{ lt: cursor\.id \}/);
  assert.match(code, /a\.at !== b\.at/);
  assert.match(code, /LedgerReadIntegrityError/);
  assert.match(code, /financial_data_review/);
  assert.match(code, /hasMore = candidates\.length > pageSize/);
  assert.doesNotMatch(code, /\.skip\(/);
  assert.doesNotMatch(code, /prisma\.\w+\.(?:create|update|upsert|delete)\(/);
});
test('both Android Activity workspaces load bounded pages without enabling posting', () => {
  const admin = read('mobile/src/app/global/tenant/[org].tsx');
  const officer = read('mobile/src/app/(officer)/home.tsx');
  const api = read('mobile/src/api/http.ts');
  const config = read('mobile/src/api/config.ts');
  assert.match(admin, /listGlobalTenantLedgerPage/);
  assert.match(officer, /listLedgerPage/);
  assert.match(admin, /Load older Activity/);
  assert.match(officer, /Load older Activity/);
  assert.match(api, /ledger\/page/);
  assert.match(config, /PAYMENT_WRITES_ENABLED\s*=\s*false/);
});
