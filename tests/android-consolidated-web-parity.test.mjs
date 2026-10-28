import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('consolidated financial readers, clearance and P3 are present without native writes',()=>{
 const http=read('mobile/src/api/http.ts'), type=read('mobile/src/api/types.ts');
 const setup=read('mobile/src/app/_layout.tsx'), maintenance=read('mobile/src/components/maintenance/ServiceAdvisory.tsx');
 const money=read('mobile/src/api/config.ts');
 for(const src of ['getFinanceReview:', 'listLedgerPage:', 'listGlobalTenantLedgerPage:', 'getOwnClearance:']) assert.ok(http.includes(src),src);
 for(const src of ['FinanceReviewKind','LedgerPage','StudentHoldReason','holdReasons?:']) assert.ok(type.includes(src),src);
 assert.match(setup,/<ServiceAdvisory/);
 assert.match(maintenance,/45_000/);
 assert.match(money,/PAYMENT_WRITES_ENABLED = false/);
 assert.match(money,/MOBILE_BUSINESS_WRITES_ENABLED = false/);
});
test('new financial endpoints are read only, separately gated and retain legacy API',()=>{
 const office=read('app/api/mobile/orgs/[org]/finance-review/route.ts');
 const pages=['app/api/mobile/orgs/[org]/ledger/page/route.ts',
  'app/api/mobile/global/orgs/[org]/ledger/page/route.ts'];
 assert.match(office,/requireMobileOfficer/);
 assert.doesNotMatch(office,/export const POST/);
 for(const file of pages){const api=read(file);
  assert.match(api,/export const GET/);assert.doesNotMatch(api,/export const POST/);}
 assert.match(read('app/api/mobile/orgs/[org]/ledger/route.ts'),/listLedger\(/);
});
test('native UI has updated clearance consent and bounded search',()=>{
 const student=read('mobile/src/app/d/[dept]/clearance.tsx');
 const privacy=read('mobile/src/components/privacy/DataPrivacyNotice.tsx');
 const receipt=read('mobile/src/app/(officer)/reference-search.tsx');
 assert.match(student,/holdReasons=\{!officerMode/);
 assert.match(student,/AppState\.addEventListener/);
 assert.match(student,/2 \* 60_000/);
 assert.match(privacy,/registered-email verification/);
 assert.match(receipt,/maxLength=\{80\}/);
 assert.match(receipt,/accessibilityLabel="Clear reference search"/);
});
