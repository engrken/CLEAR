import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isMobileRequestAllowed } from '../lib/mobile/production-readonly.ts';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const production = { vercelEnv: 'production', gitRef: 'main' };
const preview = { vercelEnv: 'preview', gitRef: 'android-parity-integration' };

test('live views remain available, with route-level authorization still required', () => {
  for (const path of [
    '/api/mobile/orgs', '/api/mobile/orgs/jiecep/clearance',
    '/api/mobile/orgs/jiecep/dashboard', '/api/mobile/orgs/jiecep/students',
    '/api/mobile/global/overview', '/api/mobile/global/provisions',
    '/api/mobile/global/orgs/jiecep/ledger',
  ]) {
    assert.equal(isMobileRequestAllowed('GET', path, production), true, path);
  }
});

test('OTP and logout session lifecycle remain available on Production', () => {
  for (const path of [
    '/api/mobile/global/auth/request-code',
    '/api/mobile/global/auth/verify-code',
    '/api/mobile/orgs/jiecep/auth/request-code',
    '/api/mobile/orgs/jiecep/auth/verify-code',
  ]) {
    assert.equal(isMobileRequestAllowed('POST', path, production), true, path);
  }
  for (const path of ['/api/mobile/global/auth/session', '/api/mobile/orgs/jiecep/auth/session']) {
    assert.equal(isMobileRequestAllowed('DELETE', path, production), true, path);
  }
});

test('no tenant or finance business mutations on Production, even for superadmins', () => {
  for (const [method, path] of [
    ['POST', '/api/mobile/global/provisions'],
    ['POST', '/api/mobile/global/provisions/manage'],
    ['POST', '/api/mobile/orgs/jiecep/proofs'],
    ['POST', '/api/mobile/orgs/jiecep/payments'],
    ['POST', '/api/mobile/orgs/jiecep/remittances/r1/verify'],
    ['DELETE', '/api/mobile/orgs/jiecep/students/s1'],
    ['PUT', '/api/mobile/global/orgs/jiecep/dashboard'],
    ['PATCH', '/api/mobile/global/overview'],
  ]) {
    assert.equal(isMobileRequestAllowed(method, path, production), false, method + ' ' + path);
  }
});

test('Production tenant operations require explicit server opt-in, only for existing guarded global routes', () => {
  const optIn = { ...production, tenantOperationsEnabled: true };
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/global/provisions', optIn), true);
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/global/provisions/manage', optIn), true);
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/global/provisions', { ...production, tenantOperationsEnabled: false }), false);
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/global/provisions', { vercelEnv: 'preview', gitRef: 'main', tenantOperationsEnabled: true }), false);
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/global/provisions', { vercelEnv: 'production', gitRef: 'other', tenantOperationsEnabled: true }), false);
  for (const path of [
    '/api/mobile/orgs/jiecep/payments',
    '/api/mobile/orgs/jiecep/proofs',
    '/api/mobile/orgs/jiecep/remittances/r1/verify',
    '/api/mobile/orgs/jiecep/remittances/r1/invalidate',
    '/api/mobile/global/provisions/evil',
  ]) assert.equal(isMobileRequestAllowed('POST', path, optIn), false, path);
  const policy = read('lib/mobile/provisioning-policy.ts');
  assert.match(policy, /MOBILE_TENANT_OPERATIONS_ENABLED === 'true'/);
  assert.match(policy, /requireAndroidProvisioningPreview/);
  const provisions = read('app/api/mobile/global/provisions/route.ts');
  assert.match(provisions, /requireGlobalMobileAdmin\(req\)/);
  const manage = read('app/api/mobile/global/provisions/manage/route.ts');
  assert.match(manage, /requireGlobalMobileAdmin\(req\)/);
});

test('unknown environment fails closed and Preview permits only its two tenant QA actions', () => {
  for (const env of [{}, { vercelEnv: 'preview', gitRef: 'main' }, { vercelEnv: 'development' }]) {
    assert.equal(isMobileRequestAllowed('POST', '/api/mobile/global/provisions', env), false);
    assert.equal(isMobileRequestAllowed('POST', '/api/mobile/global/provisions/manage', env), false);
  }
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/global/provisions', preview), true);
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/global/provisions/manage', preview), true);
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/orgs/jiecep/payments', preview), false);
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/orgs/jiecep/proofs', preview), false);
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/global/auth/request-code/extra', production), false);
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/orgs/jiecep/other/request-code', production), false);
});

test('every mobile handler checks the server-side mutation policy', () => {
  const http = read('lib/mobile/http.ts');
  assert.match(http, /isMobileRequestAllowed\(req\.method, new URL\(req\.url\)\.pathname/);
  assert.match(http, /throw new ApiFailure\(403, 'read_only'/);
  assert.ok(http.indexOf('isMobileRequestAllowed(req.method') < http.indexOf('const out = await fn(req, ctx)'));
});

test('clearance never certifies a student when historical obligations cannot be read', () => {
  const clearance = read('lib/clearance.ts');
  const start = clearance.indexOf('export async function loadHistoricalDebts(');
  const end = clearance.indexOf('export async function loadStudentObligationRecords(', start);
  assert.ok(start >= 0 && end > start);
  const body = clearance.slice(start, end);
  assert.match(body, /catch\s*\{/);
  assert.match(body, /throw new Error\('Historical obligations could not be verified/);
  assert.doesNotMatch(body, /return \[\]/);
});

test('tenant administrator portal is server-guarded, tenant-bound and GET-only', () => {
  const route = read('app/api/mobile/orgs/[org]/portal/route.ts');
  assert.match(route, /requireMobileOfficer\(req, slug, null\)/);
  assert.match(route, /isAdminRole\(officer\.role\)/);
  assert.match(route, /ApiFailure\(403, 'forbidden'/);
  assert.match(route, /organizationId: org\.id/);
  assert.match(route, /export const GET/);
  assert.doesNotMatch(route, /export const (?:POST|PUT|PATCH|DELETE)/);
  assert.match(route, /mode: 'read_only'/);

  const api = read('mobile/src/api/http.ts');
  assert.match(api, /getTenantPortal: \(s\) => request\(\x60\$\{org\(s\.org\.subdomain\)\}\/portal\x60, as\(s\)\)/);
  const root = read('mobile/src/app/_layout.tsx');
  assert.match(root, /name="officer\/tenant-portal"/);
  const more = read('mobile/src/app/(officer)/more.tsx');
  assert.match(more, /isTenantAdmin/);
  assert.match(more, /My tenant portal and settings/);
});

test('Android cannot post cash; global tenant changes require separately verified server permissions', () => {
  const config = read('mobile/src/api/config.ts');
  assert.match(config, /export const PAYMENT_WRITES_ENABLED = false;/);
  assert.match(config, /export const MOBILE_BUSINESS_WRITES_ENABLED = false;/);
  const client = read('mobile/src/api/http.ts');
  assert.match(client, /submitProof:.*MOBILE_BUSINESS_WRITES_ENABLED/);
  // The client exposes native forms only when a live global bearer session
  // receives a server-issued grant. The server denies every mutation without
  // its separate default-off Production opt-in regardless of client flags.
  assert.match(client, /getGlobalManagementCapabilities:.*global\/write-capabilities/);
  assert.match(client, /provisionTenant:[\s\S]*?request\('\/global\/provisions'/);
  assert.match(client, /manageTenant:[\s\S]*?request\('\/global\/provisions\/manage'/);
  const grantRoute = read('app/api/mobile/global/write-capabilities/route.ts');
  assert.match(grantRoute, /requireGlobalMobileAdmin\(req\)/);
  assert.match(grantRoute, /canRunMobileGlobalTenantOperations/);
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/global/provisions', production), false);
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/global/provisions/manage', production), false);
  const policy = read('lib/mobile/http.ts');
  assert.match(policy, /tenantOperationsEnabled: process\.env\.MOBILE_TENANT_OPERATIONS_ENABLED === 'true'/);
  const layout = read('mobile/src/app/_layout.tsx');
  assert.match(layout, /Stack\.Protected guard=\{MOBILE_BUSINESS_WRITES_ENABLED\}/);
  const student = read('mobile/src/app/d/[dept]/clearance.tsx');
  assert.match(student, /status === 'hold' && MOBILE_BUSINESS_WRITES_ENABLED/);
  const globalIndex = read('mobile/src/app/global/provisions/index.tsx');
  assert.match(globalIndex, /operations\.data\?\.tenantOperationsEnabled/);
  const globalDetail = read('mobile/src/app/global/provisions/[id].tsx');
  assert.match(globalDetail, /if \(!operations\.data\?\.tenantOperationsEnabled\)/);
});

test('Android finance POST is denied even when a deployment or CI flag requests it', () => {
  const path = '/api/mobile/orgs/jiecep/payments';
  for (const env of [
    production,
    { ...production, financialWritesEnabled: true },
    { ...production, tenantOperationsEnabled: true, financialWritesEnabled: true },
    { vercelEnv: 'preview', gitRef: 'feature/android-v1.5.0-write-foundation-20261101',
      financialWritesEnabled: true, localFinancialCiOnly: true },
  ]) {
    assert.equal(isMobileRequestAllowed('POST', path, env), false, JSON.stringify(env));
    assert.equal(isMobileRequestAllowed('PUT', path, env), false);
    assert.equal(isMobileRequestAllowed('PATCH', path, env), false);
    assert.equal(isMobileRequestAllowed('DELETE', path, env), false);
  }
  assert.equal(isMobileRequestAllowed('GET', path, production), true,
    'Read endpoints still require their individual authentication and role checks.');
});
