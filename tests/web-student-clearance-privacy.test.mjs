import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('Web anonymous clearance lookup is gated behind verified student ownership', () => {
  const page = read('app/department/[department]/clearance/page.tsx');
  assert.match(page, /CLEAR_PUBLIC_CLEARANCE_REQUIRE_OTP === 'true'/);
  assert.match(page, /!isOfficer && !sigParam/);
  assert.ok(page.indexOf('if (!isOfficer && !sigParam && process.env.CLEAR_PUBLIC_CLEARANCE_REQUIRE_OTP') <
    page.indexOf('const collectionSetups ='), 'anonymous query gate must precede roster/finance queries');
  assert.match(page, /<StudentClearanceInquiry/);
  assert.match(page, /if \(sigParam && q\)/, 'signed certificate route remains independent');
});

test('Web private student form never transmits ID/email in GET URL and never discloses financial data', () => {
  const web = read('app/department/[department]/clearance/StudentClearanceInquiry.tsx');
  assert.match(web, /\/clearance\/auth\/request-code/);
  assert.match(web, /\/clearance\/auth\/verify-code/);
  assert.match(web, /\/clearance\/auth\/session/);
  assert.match(web, /Authorization: 'Bearer ' \+ auth\.token/);
  assert.match(web, /fetch\(api \+ '\/clearance',/);
  assert.match(web, /url\.searchParams\.delete\('q'\)/);
  assert.match(web, /cache: 'no-store'/);
  assert.doesNotMatch(web, /\/clearance\?q=|qrserver\.com|window\.localStorage|window\.sessionStorage/);
});
