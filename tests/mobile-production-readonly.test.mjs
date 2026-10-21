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
  assert.match(more, /My tenant portal \(read-only\)/);
});

test('Android live viewer cannot invoke proof, payment or tenant changes', () => {
  const config = read('mobile/src/api/config.ts');
  assert.match(config, /export const PAYMENT_WRITES_ENABLED = false;/);
  assert.match(config, /export const MOBILE_BUSINESS_WRITES_ENABLED = false;/);
  const client = read('mobile/src/api/http.ts');
  for (const method of ['submitProof', 'provisionTenant', 'manageTenant']) {
    assert.match(client, new RegExp(method + ':.*MOBILE_BUSINESS_WRITES_ENABLED'));
  }
  const layout = read('mobile/src/app/_layout.tsx');
  assert.match(layout, /Stack\.Protected guard=\{MOBILE_BUSINESS_WRITES_ENABLED\}/);
  const student = read('mobile/src/app/d/[dept]/clearance.tsx');
  assert.match(student, /status === 'hold' && MOBILE_BUSINESS_WRITES_ENABLED/);
  const globalIndex = read('mobile/src/app/global/provisions/index.tsx');
  assert.match(globalIndex, /MOBILE_BUSINESS_WRITES_ENABLED/);
  const globalDetail = read('mobile/src/app/global/provisions/[id].tsx');
  assert.match(globalDetail, /if \(!MOBILE_BUSINESS_WRITES_ENABLED\)/);
});
