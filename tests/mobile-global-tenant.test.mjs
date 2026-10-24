// Regression checks for the web-equivalent Global Superadmin tenant scope.
// No database credentials, student records or financial writes are needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const roots = [
  'dashboard',
  'students',
  'ledger',
  'remittances',
];

test('global tenant authorization mirrors web superadmin bypass', () => {
  const web = source('lib/permissions.ts');
  assert.match(web, /if \(isSuper\) \{/);
  assert.match(web, /allowedTabs: \[\.\.\.ALL_TABS\]/);
  const mobile = source('lib/mobile/global-tenant.ts');
  assert.match(mobile, /requireGlobalMobileAdmin\(req\)/);
  assert.match(mobile, /organization\.findUnique/);
  assert.doesNotMatch(mobile, /isOrganizationActive/);
  assert.doesNotMatch(mobile, /requireMobileOfficer/);
});

test('global tenant API is read-only, authenticated and does not write money', () => {
  for (const name of roots) {
    const route = source(`app/api/mobile/global/orgs/[org]/${name}/route.ts`);
    assert.match(route, /requireGlobalMobileTenant\(req, slug\)/, name);
    assert.match(route, /export const GET = handler/, name);
    assert.doesNotMatch(route, /export const (POST|PATCH|PUT|DELETE)/, name);
    assert.doesNotMatch(route, /recordPayment|verifyRemittance|invalidateRemittance/, name);
  }
});

test('global bearer tokens are never silently exchanged for tenant officer sessions', () => {
  const mobile = source('lib/mobile/global-tenant.ts');
  assert.doesNotMatch(mobile, /createMobileSession|MobileSession\.create/);
  const api = source('mobile/src/api/http.ts');
  for (const name of ['getGlobalTenantDashboard', 'listGlobalTenantStudents', 'listGlobalTenantLedger', 'listGlobalTenantRemittances']) {
    assert.ok(api.includes(name + ':'), 'Missing global tenant endpoint ' + name);
  }
  assert.match(api, /\/global\/orgs\//);
  const root = source('mobile/src/app/_layout.tsx');
  assert.match(root, /global\/tenant\/\[org\]/);
  assert.match(root, /guard=\{!!globalSession && !session\}/);
  const config = source('mobile/src/api/config.ts');
  assert.match(config, /PAYMENT_WRITES_ENABLED\s*=\s*false/);
});

test('tenant endpoints keep the tenant id in all data lookups', () => {
  const data = source('lib/mobile/data.ts');
  assert.match(data, /organizationId: org\.id/);
  const proofs = source('app/api/mobile/global/orgs/[org]/remittances/route.ts');
  assert.match(proofs, /organizationId: org\.id/);
  assert.match(proofs, /status: 'Pending Verification'/);
});

test('global tenant activity rounds fractional-hour legacy penalties in centavos', () => {
  const data = source('lib/mobile/data.ts');
  assert.match(data, /assessedCentavos: p\.assessedAmount != null/);
  assert.match(data, /Math\.round\(Number\(p\.hoursLate\) \* toCentavos\(p\.ratePerHour\)\)/);
  assert.doesNotMatch(data, /toCentavos\(p\.assessedAmount \?\? Number\(p\.hoursLate\)/);
  // Production legacy data includes hours such as 4.4333 with a 50-peso rate.
  // The old peso product (221.665) is rejected by strict monetary parsing.
  assert.equal(String(4.4333 * 50), '221.665');
  assert.equal(Math.round(4.4333 * 5000), 22167);
});
