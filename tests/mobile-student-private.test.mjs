import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  trustedStudentRequestSource, studentDigest, validStudentEmail,
  STUDENT_GENERIC_SENT, STUDENT_OTP_TTL_MS, STUDENT_OTP_ATTEMPTS,
} from '../lib/mobile/student-policy.ts';
import { isMobileRequestAllowed } from '../lib/mobile/production-readonly.ts';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('student identity policy refuses spoofable/missing ingress', () => {
  const req = (headers) => new Request('https://clear.example', { headers });
  const live = { vercel: '1', environment: 'production' };
  assert.equal(trustedStudentRequestSource(req({ 'x-forwarded-for': '8.8.8.8' }), live), null);
  assert.equal(trustedStudentRequestSource(req({ 'x-vercel-forwarded-for': '8.8.8.8' }), {}), null);
  assert.equal(trustedStudentRequestSource(req({ 'x-vercel-forwarded-for': '8.8.8.8, 9.9.9.9' }), live), null);
  assert.equal(trustedStudentRequestSource(req({ 'x-vercel-forwarded-for': '8.8.8.8' }), live), '8.8.8.8');
});

test('OTP digests separate purpose and identity with no plaintext', () => {
  const secret = 'a'.repeat(32);
  const a = studentDigest('otp:id1', '123456', secret);
  assert.match(a, /^[a-f0-9]{64}$/);
  assert.notEqual(a, studentDigest('otp:id2', '123456', secret));
  assert.notEqual(a, studentDigest('session', '123456', secret));
  assert.equal(validStudentEmail(' Student@School.EDU '), 'student@school.edu');
  assert.equal(validStudentEmail('not-email'), null);
  assert.equal(STUDENT_OTP_TTL_MS, 300_000);
  assert.equal(STUDENT_OTP_ATTEMPTS, 5);
  assert.doesNotMatch(STUDENT_GENERIC_SENT, /not found|unknown account/i);
});

test('student auth mutations allow only the intended lifecycle routes', () => {
  const env = { vercelEnv: 'production', gitRef: 'main' };
  for (const leaf of ['request-code', 'verify-code']) {
    assert.equal(isMobileRequestAllowed('POST', '/api/mobile/orgs/jiecep/student-auth/' + leaf, env), true);
  }
  assert.equal(isMobileRequestAllowed('DELETE', '/api/mobile/orgs/jiecep/student-auth/session', env), true);
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/orgs/jiecep/student-auth/session', env), false);
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/orgs/jiecep/clearance', env), false);
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/orgs/jiecep/student-auth/verify-code/other', env), false);
});

test('student-private response is identity-bound, minimal and feature gated', () => {
  const source = read('lib/mobile/student-auth.ts');
  assert.match(source, /STUDENT_CLEARANCE_PRIVATE_ENABLED|studentIdentityEnabled/);
  assert.match(source, /student\.studentId, org\.activeAy, org\.activeTerm/);
  assert.match(source, /result\.student\.id !== session\.student\.id/);
  assert.match(source, /session\.organizationId !== org\.id/);
  assert.match(source, /session\.academicYear !== org\.activeAy/);
  assert.match(source, /session\.term !== org\.activeTerm/);
  assert.match(source, /if \(consumed\.count !== 1\) throw INVALID/);
  assert.match(source, /studentAuthBudget\.updateMany/);
  assert.match(source, /attempts: \{ lt: STUDENT_OTP_ATTEMPTS \}/);
  const start = source.indexOf('  return { status: result.isCleared');
  const end = source.indexOf('};', start);
  const payload = source.slice(start, end);
  assert.doesNotMatch(payload, /studentName|studentId|unpaidItems|outstandingCentavos/);
  assert.match(payload, /qrToken: null/);
  const route = read('app/api/mobile/orgs/[org]/student-auth/session/route.ts');
  assert.doesNotMatch(route, /searchParams|body\.studentId|body\.email/);
});

test('private student feature disables anonymous mobile clearance lookup after activation', () => {
  const route = read('app/api/mobile/orgs/[org]/clearance/route.ts');
  assert.match(route, /studentIdentityEnabled\(\) && !officer/);
  assert.ok(route.indexOf('studentIdentityEnabled() && !officer') < route.indexOf('getStudentClearance(org.id, q'));
  const screen = read('mobile/src/app/d/[dept]/student-verify.tsx');
  assert.match(screen, /verifyStudentCode/);
  assert.match(screen, /getMyStudentClearance/);
  assert.doesNotMatch(screen, /lookupClearance\(/);
  const portal = read('mobile/src/app/d/[dept]/index.tsx');
  assert.match(portal, /STUDENT_PRIVATE_CLEARANCE_ENABLED/);
  const layout = read('mobile/src/app/_layout.tsx');
  assert.match(layout, /name="d\/\[dept\]\/student-verify"/);
});
