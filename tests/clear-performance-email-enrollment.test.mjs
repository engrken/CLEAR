import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('tenant roster can filter missing registered emails without public lookup or OTP bypass',()=>{
  const page=read('app/department/[department]/(protected)/students/page.tsx');
  const ui=read('app/department/[department]/(protected)/students/StudentsClient.tsx');
  assert.match(page,/requireTabAccess\('tab-students', cleanDepartment\)/);
  assert.match(page,/resolvedSearch.email === 'missing'/);
  assert.match(page,/if \(missingEmailOnly\) andFilters.push\(\{ OR: \[\{ email: null \}, \{ email: '' \}\] \}\)/);
  assert.match(page,/const unfilteredRoster = !missingEmailOnly/);
  assert.match(page,/missingEmailOnly=\{missingEmailOnly\}/);
  assert.match(ui,/View students needing verified email/);
  assert.match(ui,/aria-pressed=\{missingEmailOnly\}/);
  assert.match(ui,/email: missingEmailOnly \? '' : 'missing'/);
  assert.match(ui,/Edit Student/);
});
test('private student clearance returns safe per-stage timing only to authorized OTP caller',()=>{
  const api=read('app/api/mobile/orgs/[org]/clearance/route.ts');
  const http=read('lib/mobile/http.ts');
  const ui=read('app/department/[department]/clearance/StudentClearanceInquiry.tsx');
  assert.match(api,/requireStudentClearanceSession\(req, org\)/);
  assert.match(api,/const authorizedAt = performance.now\(\)/);
  assert.match(api,/const calculatedAt = performance.now\(\)/);
  assert.match(api,/response.headers.set\('Server-Timing'/);
  assert.match(api,/auth;dur/);
  assert.match(api,/clearance;dur/);
  assert.match(api,/certificate;dur/);
  assert.match(api,/total;dur/);
  assert.match(api,/return response;/);
  assert.match(http,/res.headers.set\('Cache-Control', 'no-store'\)/);
  assert.match(ui,/response.headers.get\('Server-Timing'\)/);
  assert.match(ui,/performance.now\(\) - startedAt/);
  assert.match(ui,/setLookupTiming\(null\)/);
  assert.match(ui,/Timing is shown only on your screen and is not stored/);
  assert.doesNotMatch(ui,/console\.log\(.*(studentId|registeredEmail|auth\.token|privateResult|qrToken)/);
});
