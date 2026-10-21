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
