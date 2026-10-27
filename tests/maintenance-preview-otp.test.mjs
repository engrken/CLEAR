import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url),'utf8');

test('Global Administrator staging OTP remains single-use and five-minute limited', () => {
  const s = read('lib/super-admin-otp.ts');
  assert.match(s, /const TTL_MS = 5 \* 60 \* 1000/);
  assert.match(s, /prisma\.verificationToken\.upsert/);
  assert.match(s, /crypto\.createHmac\('sha256', secret\)/);
  assert.match(s, /tx\.verificationToken\.deleteMany/);
  assert.match(s, /MAX_GUESSES = 5/);
  assert.match(s, /MAX_SENDS_PER_WINDOW = 5/);
});
test('staging emails are clearly labeled and production keeps original subject', () => {
  const s = read('lib/super-admin-otp.ts');
  assert.match(s, /process\.env\.VERCEL_ENV === 'preview'/);
  assert.match(s, /CLEAR STAGING ONLY: Global Administrator Verification Code/);
  assert.match(s, /CLEAR System: System Admin Verification Code/);
  assert.match(s, /STAGING TEST ONLY/);
  const page = read('app/dashboard/provisions/maintenance/page.tsx');
  assert.match(page, /Request a NEW code from this staging page/);
});
test('OTP diagnostics avoid recipient, codes, hashes and mail-provider exceptions', () => {
  const s = read('lib/super-admin-otp.ts');
  for (const message of [
    'preview request suppressed: identity not eligible',
    'preview request suppressed: temporary lock',
    'preview request suppressed: cooldown or rate cap',
    'preview mail provider accepted dispatch',
    'delivery failure (details suppressed)',
  ]) assert.ok(s.includes(message));
  assert.doesNotMatch(s, /console\.error\('Super Admin OTP email failed:', err\)/);
  assert.match(s, /prisma\.verificationToken\.deleteMany\(\{ where: \{ identifier: e, token: hash\(code\) \} \}\)/);
  // This is a source contract, not an end-to-end SMTP connectivity test.
});
