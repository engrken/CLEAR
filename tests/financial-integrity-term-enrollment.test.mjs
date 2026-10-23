import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isEnrolledStatus } from '../lib/term-enrollment.ts';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('only explicit Enrolled status is eligible for a term mandatory package', () => {
  assert.equal(isEnrolledStatus('Enrolled'), true);
  assert.equal(isEnrolledStatus(' enrolled '), true);
  for (const status of [undefined, null, '', 'Dropped', 'Inactive', 'Cancelled', 'Withdrawn', 'Pending', 'Not Enrolled']) {
    assert.equal(isEnrolledStatus(status), false, String(status));
  }
});

test('authenticated web and mobile financial engines exclude historical roster by default', () => {
  for (const path of ['app/department/[department]/actions.ts', 'lib/financials.ts']) {
    const source = read(path);
    const start = source.indexOf('  const packageStudentMap = new Map');
    const end = source.indexOf('  Array.from(packageStudentMap.values()).forEach', start);
    assert.ok(start !== -1 && end > start, path);
    const block = source.slice(start, end);
    assert.match(block, /new Map<string, any>\(\)/, path);
    assert.match(block, /\.filter\(\(e: any\) => isEnrolledStatus\(e\.enrollmentStatus\)\)/, path);
    assert.doesNotMatch(block, /students\.map\(/, path);
  }
});

test('web/mobile clearance package is conditional on term enrollment and historical obligations remain', () => {
  const mobile = read('lib/clearance.ts');
  const web = read('app/department/[department]/clearance/page.tsx');
  const endpoint = read('app/api/mobile/orgs/[org]/clearance/route.ts');
  assert.match(mobile, /enrollmentStatus: 'Enrolled'/);
  assert.match(mobile, /isTermEnrolled && termPkg\.total > 0/);
  assert.match(mobile, /const isCleared = isEnrolled && unpaidItems\.length === 0;/);
  assert.match(mobile, /for \(const debt of historicalDebts\)/);
  assert.match(web, /termEnrolledStudentIds\.has\(student\.id\) && termPkg\.total > 0/);
  assert.match(web, /termEnrolledStudentIds\.has\(verifiedStudent\.id\) && liveUnpaid\.length === 0/);
  assert.match(web, /termEnrolledStudentIds\.has\(student\.id\) && unpaidItems\.length === 0/);
  assert.match(web, /for \(const debt of historicalByStudent\.get/);
  assert.match(endpoint, /!result\.isEnrolled \? 'not_enrolled' : result\.isCleared \? 'cleared' : 'hold'/);
});

test('web/mobile student views distinguish not enrolled from an unpaid balance', () => {
  const web = read('app/department/[department]/clearance/StudentClearanceInquiry.tsx');
  const mobile = read('mobile/src/components/ui/student.tsx');
  const types = read('mobile/src/api/types.ts');
  assert.match(web, /NOT ENROLLED THIS TERM/);
  assert.match(mobile, /Not enrolled for this term/);
  assert.match(types, /'cleared' \| 'hold' \| 'not_enrolled'/);
});

test('mobile welcome footer retains privacy statement and policy link', () => {
  const mobile = read('mobile/src/app/index.tsx');
  assert.match(mobile, /Personal data is handled in accordance with the Data Privacy Act of 2012 \(RA 10173\)\./);
  assert.doesNotMatch(mobile, /Independent CLEAR application; not an official Filamer Christian University app/);
  assert.match(mobile, /onPress=\{\(\) => void openWebPage\(PRIVACY_URL\)\}/);
});
