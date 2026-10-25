import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Verified student identity avoids redundant post-OTP directory read',()=>{
 const route=read('app/api/mobile/orgs/[org]/clearance/route.ts');
 const auth=read('lib/mobile/student-clearance-auth.ts');
 const calc=read('lib/clearance.ts');
 assert.match(route,/requireStudentClearanceSession\(req, org\)/);
 assert.match(route,/org\.activeAy, org\.activeTerm, student/);
 assert.match(route,/result\.student\.id !== student\.id/);
 assert.match(auth,/fullName: student\.fullName/);
 assert.match(calc,/verifiedStudent \?\? await prisma\.student\.findFirst/);
 assert.match(calc,/loadStudentObligationRecords\(organizationId, student, ay, term\),/);
});
test('Public student and QR paths check live closure without all treasury rows',()=>{
 const ledger=read('app/department/[department]/(protected)/realign/ledger.ts');
 const web=read('app/department/[department]/clearance/page.tsx');
 const route=read('app/api/mobile/orgs/[org]/clearance/route.ts');
 const qr=read('app/clearance/verify/page.tsx');
 assert.match(ledger,/export async function isAcademicPeriodClosed/);
 assert.match(ledger,/matchesRolloverSource\(x\.sourceFund, ay, term\)/);
 assert.match(ledger,/transactionType: "ROLLOVER_REVERSAL"/);
 assert.match(ledger,/status: "Closed"/);
 assert.match(web,/publicPeriodClosed = await isAcademicPeriodClosed/);
 assert.doesNotMatch(web,/publicPeriodLedger = await getPeriodLedger/);
 assert.match(route,/isAcademicPeriodClosed\(prisma, org\.id, org\.activeAy, org\.activeTerm\)/);
 assert.match(qr,/isAcademicPeriodClosed\(prisma, org\.id, claim\.ay, claim\.term\)/);
});
test('Student collectible read uses tenant, term and canonical SID ownership',()=>{
 const s=read('lib/clearance.ts');
 assert.match(s,/prisma\.collectible\.findMany/);
 assert.match(s,/organizationId, academicYear: ay, term/);
 assert.match(s,/status: \{ contains:/);
 assert.match(s,/encodeURIComponent\(student\.studentId\)/);
 assert.match(s,/decodeStudentDue\(due\.status\)/);
});
