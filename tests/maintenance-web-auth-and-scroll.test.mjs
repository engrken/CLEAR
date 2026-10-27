import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('both browser tenant OTP entry points use narrow JSON endpoint, not Server Action POST', () => {
  const helper = read('lib/tenant-login-otp-client.ts');
  const publicLogin = read('app/department/[department]/components/OtpModal.tsx');
  const officerLogin = read('app/department/[department]/LoginModal.tsx');
  assert.match(helper, /\/api\/department\//);
  assert.match(helper, /\/auth\/request-code/);
  assert.match(helper, /method: 'POST'/);
  assert.match(helper, /credentials: 'same-origin'/);
  assert.match(helper, /response\.json\(\)\.catch/);
  for (const source of [publicLogin, officerLogin]) {
    assert.match(source, /requestTenantLoginOtp\(/);
    assert.doesNotMatch(source, /from ['"](?:\.\.\/|\.\/)auth-actions['"]/);
  }
});

test('web OTP API enforces bounded requests and delegates to existing secure unified OTP service', () => {
  const api = read('app/api/department/[department]/auth/request-code/route.ts');
  const source = read('lib/department-otp.ts');
  assert.match(api, /export async function POST/);
  assert.match(api, /raw\.length > 2048/);
  assert.match(api, /email\.length > 254/);
  assert.match(api, /issueDepartmentOtp\(department, email\)/);
  assert.match(source, /isReservedGlobalAdminEmail\(normalizedEmail\)/);
  assert.match(source, /issueSuperAdminOtp\(normalizedEmail\)/);
  assert.match(source, /const COOLDOWN_MS = 60 \* 1000/);
  assert.match(source, /const MAX_DAILY_SENDS = 10/);
  assert.match(source, /const TTL_MS = 5 \* 60 \* 1000/);
});

test('NextAuth allows Global operator recovery but disallows tenant login during FULL', () => {
  const auth = read('auth.ts');
  const verifyGlobal = auth.indexOf('verifySuperAdminOtp(email, code)');
  const policy = auth.indexOf('maintenanceForTenant(department)');
  const tenant = auth.indexOf('verifyDepartmentOtp(department, email, code)');
  assert.ok(verifyGlobal > -1 && policy > verifyGlobal && tenant > policy);
  assert.match(auth, /maintenance\.mode === 'FULL'/);
});

test('Global Administrator OTP completion uses fresh document navigation to prevent stale Bootstrap scroll locks', () => {
  const modal = read('app/dashboard/components/AdminOtpModal.tsx');
  assert.match(modal, /window\.location\.assign\(destination\)/);
  assert.doesNotMatch(modal, /router\.push\(/);
  assert.doesNotMatch(modal, /querySelectorAll\([\s\S]*?\.modal-backdrop/);
  assert.match(modal, /signIn\(/);
});
