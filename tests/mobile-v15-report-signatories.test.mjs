import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isMobileRequestAllowed,canRunMobileReportSignatoryWrites} from '../lib/mobile/production-readonly.ts';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('report signatory writes are independently feature gated, not financial grants',()=>{
 const path='/api/mobile/orgs/jiecep/report-signatories';
 assert.equal(isMobileRequestAllowed('POST',path,{}),false);
 assert.equal(isMobileRequestAllowed('POST',path,{vercelEnv:'production',gitRef:'main',reportSignatoryWritesEnabled:true}),true);
 assert.equal(isMobileRequestAllowed('POST','/api/mobile/orgs/jiecep/payments',
   {vercelEnv:'production',gitRef:'main',reportSignatoryWritesEnabled:true}),false);
 assert.equal(canRunMobileReportSignatoryWrites({vercelEnv:'preview',gitRef:'other',reportSignatoryWritesEnabled:true}),false);
});
test('report presentation uses web signatory table, serializable version guard and audit',()=>{
 const route=src('app/api/mobile/orgs/[org]/report-signatories/route.ts');
 assert.match(route,/requireMobileOfficer\(req,slug,'tab-report'\)/);
 assert.match(route,/canRunMobileReportSignatoryWrites/);
 assert.match(route,/createHash\('sha256'\)/);
 assert.match(route,/isolationLevel:Prisma\.TransactionIsolationLevel\.Serializable/);
 assert.match(route,/tx\.signatory\.deleteMany/);
 assert.match(route,/tx\.signatory\.createMany/);
 assert.match(route,/UPDATE_SIGNATORIES/);
 assert.match(route,/reportSchoolName:schoolName/);
 assert.match(route,/reportSchoolAddress:schoolAddress\|\|null/);
 assert.match(route,/SAVE REPORT PRESENTATION/);
 assert.match(route,/take:21/);
 assert.match(route,/list.length>20/);
 assert.doesNotMatch(route,/collection\.update|fundTransfer\.create|payment\.create/);
 assert.match(src('app/api/mobile/orgs/[org]/write-capabilities/route.ts'),/'reports.signatories.manage'/);
 assert.match(src('mobile/src/app/(officer)/_layout.tsx'),/can\('tab-report'\)/);
});
