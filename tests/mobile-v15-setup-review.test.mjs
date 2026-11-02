import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('fee and fund setup are current period, read-only and tenant authorized',()=>{
 const s=src('app/api/mobile/orgs/[org]/setup-review/route.ts');
 assert.match(s,/requireMobileOfficer\(req,slug,'tab-setup'\)/);
 assert.match(s,/organizationId:org\.id,academicYear:org\.activeAy,term:org\.activeTerm/);
 assert.match(s,/prisma\.fund\.findMany/);
 assert.match(s,/prisma\.collectionSetup\.findMany/);
 assert.match(s,/toCentavos/);
 assert.match(s,/fundsTotal:fundCount,feesTotal:feeCount/);
 assert.doesNotMatch(s,/export const POST|prisma\.fund\.update|prisma\.collectionSetup\.update/);
 const u=src('mobile/src/app/(officer)/setup-review.tsx');
 assert.match(u,/can\('tab-setup'\)/);
 assert.match(u,/getSetupReview/);
 assert.match(u,/openingCentavos/);
 assert.match(u,/openDepartmentModule/);
});
