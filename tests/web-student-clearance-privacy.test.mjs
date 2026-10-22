import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('anonymous browser student inquiry requires OTP unconditionally before roster and financial queries', () => {
  const page = read('app/department/[department]/clearance/page.tsx');
  const guard = page.indexOf('if (!isOfficer && !(sigParam && q))');
  assert.ok(guard > 0);
  assert.ok(guard < page.indexOf('const collectionSetups ='), 'guard must be before all finance queries');
  assert.match(page, /redirect\(`\$\{basePath\}\/clearance`\)/);
  assert.match(page, /<StudentClearanceInquiry/);
  assert.match(page, /<ClearanceClientView/, 'public payment proof must remain available without anonymous clearance lookup');
  assert.match(page, /defaultStudentId=""/, 'public proof workflow cannot reuse an anonymous roster lookup');
  assert.match(page, /if \(sigParam && q\)/, 'valid signed-certificate flow is retained');
  const invalid = page.indexOf('if (sigParam && q && !verifyClearanceSignature');
  assert.ok(invalid > 0 && invalid < page.indexOf('const collectionSetups ='),
    'forged signatures must fail before financial and roster queries');
  assert.doesNotMatch(page, /CLEAR_PUBLIC_CLEARANCE_REQUIRE_OTP|RECORD NOT FOUND|api\.qrserver\.com|studentRecord = await prisma\.student\.findFirst/);
  assert.match(page, /referrer: 'no-referrer'/);
});

test('private web student UI protects bearer credentials, financial fields and shared computers', () => {
  const src = read('app/department/[department]/clearance/StudentClearanceInquiry.tsx');
  assert.match(src, /clearance\/auth\/request-code/);
  assert.match(src, /clearance\/auth\/verify-code/);
  assert.match(src, /clearance\/auth\/session/);
  assert.match(src, /Authorization: 'Bearer ' \+ auth\.token/);
  assert.match(src, /fetch\(api \+ '\/clearance',/);
  assert.match(src, /cache: 'no-store'/);
  assert.doesNotMatch(src, /sessionStorage|localStorage|qrserver\.com|\/clearance\?q=/);
  assert.match(src, /window\.setTimeout\(\(\) => void finish\(\), 2 \* 60_000\)/);
  assert.match(src, /visibilitychange/);
  assert.match(src, /privateResult\.studentName !== null/);
  assert.match(src, /privateResult\.unpaidItems !== null/);
});
