import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isMobileRequestAllowed } from '../lib/mobile/production-readonly.ts';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const prod = { vercelEnv: 'production', gitRef: 'main' };

test('student OTP and revocation are identity operations, but postings remain blocked', () => {
  for (const suffix of ['request-code', 'verify-code']) {
    assert.equal(isMobileRequestAllowed('POST', '/api/mobile/orgs/jiecep/clearance/auth/' + suffix, prod), true);
  }
  assert.equal(isMobileRequestAllowed('DELETE', '/api/mobile/orgs/jiecep/clearance/auth/session', prod), true);
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/orgs/jiecep/clearance', prod), false);
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/orgs/jiecep/proofs', prod), false);
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/orgs/jiecep/payments', prod), false);
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/orgs/jiecep/clearance/auth/unknown', prod), false);
  assert.equal(isMobileRequestAllowed('DELETE', '/api/mobile/orgs/jiecep/clearance', prod), false);
});

test('anonymous student ID/email lookups no longer reveal clearance outcomes', () => {
  const route = read('app/api/mobile/orgs/[org]/clearance/route.ts');
  assert.match(route, /requireMobileOfficer\(req, slug, 'tab-clearance'\)/);
  assert.match(route, /requireStudentClearanceSession\(req, org\)/);
  assert.match(route, /result\.student\.id !== student\.id/);
  assert.doesNotMatch(route, /optionalMobileOfficer/);
  assert.match(route, /if \(query\)/);
  assert.match(route, /studentName: null/);
  assert.match(route, /studentId: null/);
  assert.match(route, /outstandingCentavos: null/);
  assert.match(route, /qrToken: null/, 'officer has no QR issuance');
  assert.match(route, /qrToken: studentQrUrl/, 'student receives encrypted proof only after OTP');
  assert.match(route, /requireStudentClearanceSession\(req, org\)/);
  assert.match(route, /result\.student\.id !== student\.id/);
});

test('student OTP is tenant-bound, generic, single-use and stored hashed', () => {
  const source = read('lib/mobile/student-clearance-auth.ts');
  assert.match(source, /GENERIC_SENT =/);
  assert.match(source, /crypto\.createHmac\('sha256'/);
  assert.match(source, /crypto\.randomInt\(100000, 1000000\)/);
  assert.match(source, /MAX_GUESSES = 5/);
  assert.match(source, /LOCK_MS = 30 \* 60_000/);
  assert.match(source, /OTP_TTL_MS = 5 \* 60_000/);
  assert.match(source, /SESSION_TTL_MS = 10 \* 60_000/);
  assert.match(source, /verificationToken\.deleteMany\(/);
  assert.match(source, /expires: \{ gt: now \}/);
  assert.match(source, /studentId: \{ equals: studentId, mode: 'insensitive' \}/);
  assert.match(source, /organizationId: org\.id/);
  assert.match(source, /email: \{ equals: email, mode: 'insensitive' \}/);
  assert.match(source, /authThrottle\.updateMany/);
  assert.match(source, /randomBytes\(32\)/);
  assert.match(source, /clear-student:session:/);
  assert.match(source, /p\.orgId !== org\.id/);
  assert.match(source, /p\.ay !== org\.activeAy/);
  assert.match(source, /p\.term !== org\.activeTerm/);
  assert.doesNotMatch(source, /prisma\.(?:collection|penalty|onlineRemittance)\.(?:create|update|delete)/);
});

test('student OTP UI never sends arbitrary student ID as its authenticated clearance selector', () => {
  const ui = read('mobile/src/app/d/[dept]/clearance.tsx');
  const http = read('mobile/src/api/http.ts');
  assert.match(ui, /requestStudentClearanceCode/);
  assert.match(ui, /verifyStudentClearanceCode/);
  assert.match(ui, /getOwnClearance\(dept, verified\.token\)/);
  assert.match(ui, /revokeStudentClearance/);
  assert.match(ui, /officerMode/);
  assert.match(http, /getOwnClearance: \(slug, studentToken\)/);
  assert.match(http, /res\.status === 401 && token && !token\.startsWith\('clrs_'\)/);
  assert.match(http, /request\(\x60\$\{org\(slug\)\}\/clearance\x60, \{ token: studentToken \}\)/);
  assert.match(ui, /status === 'hold' && MOBILE_BUSINESS_WRITES_ENABLED/);
});

test('OTP source throttle cannot be evaded with a caller-supplied IP header or multiple hops', () => {
  const source = read('lib/mobile/student-clearance-auth.ts');
  assert.match(source, /req\.headers\.get\('x-vercel-forwarded-for'\)/);
  assert.match(source, /!forwarded\.includes\(','\)/);
  assert.match(source, /isIP\(candidate\) \? candidate : 'unknown'/);
  assert.doesNotMatch(source, /req\.headers\.get\('x-real-ip'\)|forwarded\?\.split\(','\)\[0\]/);
});

test('native first-time student clearance guidance mirrors web without storing private student data', () => {
  const ui = read('mobile/src/app/d/[dept]/clearance.tsx');
  const guide = read('mobile/src/components/student/StudentClearanceGuide.tsx');
  assert.match(ui, /!officerMode \? <StudentClearanceGuide department=\{dept\} \/>/,
    'only the public student flow shows the student guide');
  assert.match(guide, /getItem\('clear_privacy_notice_ack_v1'\)/,
    'the required privacy disclosure must be acknowledged before automatic guide');
  assert.match(guide, /clear_student_guide_v1_/);
  assert.match(guide, /setItem\(key, 'true'\)/, 'store only a non-identity completion preference');
  assert.match(guide, /How to check my clearance/, 'the tutorial is replayable');
  assert.match(guide, /CLEARED/);
  assert.match(guide, /CLEARANCE ON HOLD/);
  assert.match(guide, /NOT ENROLLED THIS TERM/);
  assert.match(guide, /six-digit code/);
  assert.match(guide, /Skip guide/);
  assert.match(guide, /Finish/);
  assert.doesNotMatch(guide, /api\.|fetch\(|studentToken|setStudentId|setEmail|setCode|Authorization/,
    'guide cannot query or persist student data or credentials');
  assert.match(ui, /getOwnClearance\(dept, verified\.token\)/, 'OTP-gated read path remains unchanged');
  assert.match(ui, /revokeStudentClearance\(dept, studentToken\)/, 'session revocation remains unchanged');
});
