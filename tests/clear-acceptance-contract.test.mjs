import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('published Android 1.2.2 identity remains stable and financial writes remain disabled', () => {
  const app = JSON.parse(read('mobile/app.json')).expo;
  assert.equal(app.android.package, 'com.rupertbulquerin.clear');
  assert.equal(app.version, '1.2.2');
  assert.equal(app.android.versionCode, 12);
  const config = read('mobile/src/api/config.ts');
  assert.match(config, /PAYMENT_WRITES_ENABLED = false/);
  assert.match(config, /MOBILE_BUSINESS_WRITES_ENABLED = false/);
});
test('student-only OTP and private response remain enforced before roster/finance access', () => {
  const web = read('app/department/[department]/clearance/page.tsx');
  const api = read('app/api/mobile/orgs/[org]/clearance/route.ts');
  const otp = read('lib/mobile/student-clearance-auth.ts');
  assert.match(web, /if \(!isOfficer && !\(sigParam && q\)\)/);
  assert.match(api, /requireMobileOfficer\(req, slug, 'tab-clearance'\)/);
  assert.match(api, /requireStudentClearanceSession\(req, org\)/);
  for (const field of ['studentName: null', 'outstandingCentavos: null', 'qrToken: null']) {
    assert.ok(api.includes(field), field);
  }
  assert.match(api, /qrToken: studentQrUrl/);
  assert.match(api, /!ledger.activeRollover/);
  assert.match(otp, /MAX_GUESSES = 5/);
  assert.match(otp, /OTP_TTL_MS = 5 \* 60_000/);
  assert.match(otp, /verificationToken\.deleteMany/);
});
test('signed certificates use official origin and no external QR generator', () => {
  const web = read('app/department/[department]/clearance/page.tsx');
  const resolver = read('lib/clearance-link-origin.ts');
  assert.doesNotMatch(web, /api\.qrserver\.com|chart\.googleapis\.com\/chart/);
  assert.doesNotMatch(web, /clearanceLinkOrigin\(\)/, 'officers verify student-owned QR instead of issuing one');
  const api = read('app/api/mobile/orgs/[org]/clearance/route.ts');
  assert.match(api, /publicBaseUrl\(req\) \+ '\/clearance\/verify\?token='/);
  assert.match(api, /qrToken: studentQrUrl/);
  assert.match(resolver, /PRODUCTION_ORIGIN = 'https:\/\/clearsys\.vercel\.app'/);
  assert.match(read('lib/clearance.ts'), /crypto\.timingSafeEqual/);
});
test('receipt reconciliation groups allocations before paging and never mutates source', () => {
  const page = read('app/department/[department]/(protected)/collections/history/page.tsx');
  const grouping = read('app/department/[department]/(protected)/collections/history/receipt-grouping.ts');
  assert.match(page, /requireTabAccess\("tab-payment", slug\)/);
  assert.match(page, /buildIssuedReceipts\(allocationLines\)/);
  assert.match(page, /filterIssuedReceipts\(grouped/);
  assert.match(page, /const total = matched.length/);
  assert.match(page, /matched\.slice\(/);
  assert.match(grouping, /reused across academic periods/);
  assert.match(grouping, /total: nonFinite \|\| unsafePrecision \|\| unsafeTotal \? null/);
  assert.doesNotMatch(page, /prisma\.\w+\.(?:create|update|delete|upsert|createMany|updateMany|deleteMany)\(/);
});
test('Void Center SQL remains tenant-bound; mobile routes stay read-only', () => {
  const page = read('app/department/[department]/(protected)/void/page.tsx');
  assert.match(page, /requireTabAccess\('tab-void', slug\)/);
  assert.match(page, /organizationId: organization\.id/);
  assert.match(page, /prisma\.collection\.count\(\{ where \}\)/);
  assert.match(page, /student: \{ is: \{/);
  assert.match(read('lib/mobile/production-readonly.ts'), /never authorize financial or business mutations/);
});
test('historical student arrears use tenant-scoped canonical marker with double-check', () => {
  const src = read('lib/student-arrears.ts');
  assert.match(src, /status: studentId/);
  assert.match(src, /encodeURIComponent\(studentId\)/);
  assert.match(src, /decodeStudentDue\(due\.status\)/);
  assert.match(src, /organizationId, balanceDue: \{ gt: 0 \}/);
});
