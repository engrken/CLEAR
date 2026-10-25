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

test('public student clearance guide is privacy-first, replayable and contains no student session data', () => {
  const page = read('app/department/[department]/clearance/page.tsx');
  const guide = read('app/department/[department]/clearance/StudentClearanceGuide.tsx');
  const guard = page.indexOf('if (!isOfficer && !(sigParam && q))');
  const insertion = page.indexOf('<StudentClearanceGuide department={cleanDepartment} />');
  assert.match(page, /import StudentClearanceGuide from '\.\/StudentClearanceGuide'/);
  assert.ok(insertion > guard, 'guide must render in the anonymous inquiry branch');
  assert.ok(insertion < page.indexOf('const collectionSetups ='), 'student guide must not depend on officer financial queries');
  assert.match(guide, /window\.localStorage\.getItem\('clear_privacy_accepted'\)/,
    'privacy acknowledgement must precede first-visit auto-launch');
  assert.match(guide, /clear_student_clearance_guide_v1:/, 'completion preference must be versioned');
  assert.match(guide, /window\.localStorage\.setItem\(storageKey, 'true'\)/);
  assert.match(guide, /How to check my clearance/, 'students must have a replay action');
  assert.match(guide, /CLEARED/);
  assert.match(guide, /CLEARANCE ON HOLD/);
  assert.match(guide, /NOT ENROLLED THIS TERM/);
  assert.match(guide, /six-digit code/);
  assert.match(guide, /Skip guide/);
  assert.match(guide, /aria-modal="true"/);
  assert.doesNotMatch(guide, /fetch\(|Authorization:|studentName|registeredEmail|outstandingCentavos/,
    'the guide must never request or retain protected clearance data');
});

test('web and shared mobile certificate verifiers reject malformed signatures before HMAC work', () => {
  const web = read('app/department/[department]/clearance/page.tsx');
  const shared = read('lib/clearance.ts');
  for (const source of [web, shared]) {
    assert.match(source, /if \(!\/\^\[0-9a-f\]\{64\}\$\/i\.test\(providedSig\)\) return false;/);
    assert.match(source, /crypto\.timingSafeEqual/);
  }
  assert.match(web, /if \(!isOfficer && !\(sigParam && q\)\)/);
});

test('both website and Android server clearance skip only validated canonical penalty payment receipts', () => {
  const page = read('app/department/[department]/clearance/page.tsx');
  const mobile = read('lib/clearance.ts');
  for (const code of [page, mobile]) {
    assert.match(code, /isCanonicalPenaltyReceipt\(c, student, penalties\)/);
    assert.match(code, /isOutstandingPenalty\(p\)/);
    assert.match(code, /isPackageCollection\(desc\)/);
  }
});
