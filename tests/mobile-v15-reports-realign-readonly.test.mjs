import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('financial reporting is a non-certified role isolated snapshot, not OR totals',()=>{
 const s=src('app/api/mobile/orgs/[org]/reports/route.ts');
 assert.match(s,/requireMobileOfficer\(req,slug,\['tab-reports','tab-report'\]\)/);
 assert.match(s,/organizationId:org\.id, academicYear:org\.activeAy, term:org\.activeTerm/);
 assert.match(s,/prisma\.collection\.aggregate/);
 assert.match(s,/Allocation|allocation/);
 assert.match(s,/NOT an official financial statement/);
 assert.doesNotMatch(s,/export const POST|export const DELETE|prisma\.collection\.update/);
 const ui=src('mobile/src/app/(officer)/reports.tsx');
 assert.match(ui,/not official/);
 assert.match(ui,/openDepartmentModule/);
});
test('fund movement is an isolated, cursor-paginated GET-only history',()=>{
 const s=src('app/api/mobile/orgs/[org]/realign-review/route.ts');
 assert.match(s,/requireMobileOfficer\(req,slug,'tab-transfer'\)/);
 assert.match(s,/organizationId:org\.id,academicYear:org\.activeAy,term:org\.activeTerm/);
 assert.match(s,/parseCursor\(q\.get\('cursor'\),org\.id,org\.activeAy,org\.activeTerm\)/);
 assert.match(s,/orderBy:\[\{timestamp:'desc'\},\{id:'desc'\}\]/);
 assert.match(s,/row\.reason\.split\('\[\[CLEAR_ROLLOVER_V2:'\)/);
 assert.doesNotMatch(s,/export const POST|export const DELETE|fundTransfer\.create|fundTransfer\.update/);
 const nav=src('mobile/src/app/(officer)/_layout.tsx');
 assert.match(nav,/guard=\{can\('tab-transfer'\)\}/);
});
