import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isMobileRequestAllowed } from '../lib/mobile/production-readonly.ts';

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const production = { vercelEnv: 'production', gitRef: 'main' };

test('Production admits only six identity-specific email-change POST routes; finance writes remain forbidden', () => {
  const base = '/api/mobile/orgs/jiecep';
  for (const path of [
    '/profile/email/request-current',
    '/profile/email/verify-current',
    '/profile/email/request-new',
    '/profile/email/confirm',
    '/clearance/email-change/request-new',
    '/clearance/email-change/confirm',
  ]) {
    assert.equal(isMobileRequestAllowed('POST', base + path, production), true, path);
    assert.equal(isMobileRequestAllowed('PUT', base + path, production), false, path);
    assert.equal(isMobileRequestAllowed('DELETE', base + path, production), false, path);
  }
  for (const path of [
    '/profile/email/change-directly',
    '/profile/email/update',
    '/clearance/email-change/admin',
    '/payments',
    '/proofs',
    '/remittances/x/verify',
    '/students/x',
    '/collections',
  ]) {
    assert.equal(isMobileRequestAllowed('POST', base + path, production), false, path);
  }
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/global/provisions', production), false);
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/global/profile/email/confirm', production), false);
});

test('officer profile routes always derive identity from a current tenant-bound mobile session', () => {
  const scope = source('lib/email-rotation-context.ts');
  assert.match(scope, /requireMobileOfficer\(req, slug, null\)/);
  assert.match(scope, /sessionKey: session\.id/);
  for (const route of ['request-current','verify-current','request-new','confirm']) {
    const api = source('app/api/mobile/orgs/[org]/profile/email/' + route + '/route.ts');
    assert.match(api, /officerEmailScope\(req, slug\)/);
    assert.match(api, /export const POST = handler/);
    assert.doesNotMatch(api, /export const (?:PATCH|PUT|DELETE)/);
  }
});

test('student roster email change is authenticated by original student-ID and registered-email OTP session', () => {
  const scope = source('lib/email-rotation-context.ts');
  const auth = source('lib/mobile/student-clearance-auth.ts');
  const web = source('app/department/[department]/clearance/StudentEmailChange.tsx');
  const portal = source('app/department/[department]/clearance/page.tsx');
  assert.match(scope, /requireStudentClearanceSession\(req, org\)/);
  assert.match(scope, /accountId: verified\.id/);
  assert.match(auth, /emailHash: digest\('email', norm\(student\.email\)\)/);
  assert.match(auth, /p\.emailHash !== digest\('email', norm\(student\.email\)\)/);
  assert.match(web, /Change my email/);
  assert.match(web, /clearance\/auth\/request-code/);
  assert.match(web, /clearance\/auth\/verify-code/);
  assert.match(web, /clearance\/email-change\/request-new/);
  assert.match(web, /clearance\/email-change\/confirm/);
  assert.match(portal, /<StudentEmailChange department=\{cleanDepartment\}/);
  for (const route of ['request-new', 'confirm']) {
    const api = source('app/api/mobile/orgs/[org]/clearance/email-change/' + route + '/route.ts');
    assert.match(api, /studentEmailScope\(req, slug\)/);
    assert.match(api, /export const POST = handler/);
  }
});

test('both old and new OTP checks are one-use, short-lived, throttled and account bound', () => {
  const engine = source('lib/email-rotation.ts');
  assert.match(engine, /OTP_MS = 5 \* 60_000/);
  assert.match(engine, /VERIFIED_MS = 10 \* 60_000/);
  assert.match(engine, /COOLDOWN_MS = 60_000/);
  assert.match(engine, /MAX_GUESSES = 5/);
  assert.match(engine, /createHmac\('sha256'/);
  assert.match(engine, /crypto\.randomInt\(100000, 1000000\)/);
  assert.match(engine, /scope\.orgId, scope\.accountId, norm\(scope\.currentEmail\), scope\.sessionKey/);
  assert.match(engine, /authThrottle\.updateMany/);
  assert.match(engine, /verificationToken\.deleteMany/);
  assert.match(engine, /consumed\.count !== 1/);
  assert.match(engine, /requireCurrentVerified\(scope\)/);
  assert.match(engine, /scope\.actor === 'student'\) return/);
});

test('confirmed roster change has serializable atomicity, uniqueness check, audit, and session revocation', () => {
  const engine = source('lib/email-rotation.ts');
  assert.match(engine, /tx\.student\.findFirst/);
  assert.match(engine, /tx\.student\.updateMany/);
  assert.match(engine, /organizationId: scope\.orgId/);
  assert.match(engine, /tx\.tenantUser\.updateMany/);
  assert.match(engine, /tx\.mobileSession\.updateMany/);
  assert.match(engine, /'clear-student:session:' \+ scope\.sessionKey/);
  assert.match(engine, /TransactionIsolationLevel\.Serializable/);
  assert.match(engine, /tx\.systemLog\.create/);
  assert.match(engine, /STUDENT_SELF_EMAIL_CHANGE/);
  assert.match(engine, /OFFICER_SELF_EMAIL_CHANGE/);
  assert.doesNotMatch(engine, /tx\.(?:collection|penalty|fund|audit|enrollment|onlineRemittance)\.(?:create|update|delete)/);
  assert.doesNotMatch(engine, /details: .*newEmail/);
  assert.doesNotMatch(engine, /details: .*rawCode/);
});

test('Android officer profile is authenticated and allows own email changes but no role/name escalation', () => {
  const root = source('mobile/src/app/_layout.tsx');
  const profile = source('mobile/src/app/officer/profile.tsx');
  const more = source('mobile/src/app/(officer)/more.tsx');
  const api = source('mobile/src/api/http.ts');
  assert.match(root, /guard=\{!!session && !globalSession\}/);
  assert.match(root, /name="officer\/profile"/);
  assert.match(more, /router\.push\('\/officer\/profile'\)/);
  assert.match(profile, /requestOfficerEmailChangeCurrentCode/);
  assert.match(profile, /verifyOfficerEmailChangeCurrentCode/);
  assert.match(profile, /requestOfficerEmailChangeNewCode/);
  assert.match(profile, /confirmOfficerEmailChange/);
  assert.match(profile, /await signOut\(\)/);
  assert.match(profile, /name, role, and permissions remain managed by your tenant administrator/);
  assert.match(api, /profile\/email\/confirm/);
  assert.doesNotMatch(profile, /updateRole|grantTab|api\.recordPayment/);
});
