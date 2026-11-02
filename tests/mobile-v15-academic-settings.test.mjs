import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isMobileRequestAllowed,canRunMobileAcademicSettingsWrites} from '../lib/mobile/production-readonly.ts';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const path='/api/mobile/orgs/jiecep/academic-calendar';
test('calendar edits fail closed unless on main with independent noncash server flag',()=>{
  assert.equal(isMobileRequestAllowed('GET',path,{}),true);
  assert.equal(isMobileRequestAllowed('POST',path,{}),false);
  assert.equal(isMobileRequestAllowed('POST',path,{vercelEnv:'production',gitRef:'main',tenantUserWritesEnabled:true}),false);
  assert.equal(isMobileRequestAllowed('POST',path,{vercelEnv:'preview',gitRef:'evil',academicSettingsWritesEnabled:true}),false);
  assert.equal(isMobileRequestAllowed('POST',path,{vercelEnv:'production',gitRef:'main',academicSettingsWritesEnabled:true}),true);
  assert.equal(isMobileRequestAllowed('DELETE',path,{vercelEnv:'production',gitRef:'main',academicSettingsWritesEnabled:true}),false);
  assert.equal(isMobileRequestAllowed('POST',path+'/delete',{vercelEnv:'production',gitRef:'main',academicSettingsWritesEnabled:true}),false);
  assert.equal(canRunMobileAcademicSettingsWrites({vercelEnv:'production',gitRef:'other',academicSettingsWritesEnabled:true}),false);
});
test('noncash settings handler prevents stranding financial and enrollment records',()=>{
  const route=src('app/api/mobile/orgs/[org]/academic-calendar/route.ts');
  assert.match(route,/requireMobileOfficer\(req, slug, 'tab-setup'\)/);
  assert.match(route,/isAdminRole\(context\.officer\.role\)/);
  assert.match(route,/canRunMobileAcademicSettingsWrites/);
  for(const table of ['fund','collectionSetup','collection','collectible','penalty','cashAdvance','audit','cashierRemittance','onlineRemittance','enrollment','fundTransfer']) {
    assert.ok(route.includes('tx.'+table+'.findMany'),table+' dependency guard missing');
  }
  assert.match(route,/Prisma\.TransactionIsolationLevel\.Serializable/);
  assert.match(route,/expectedUpdatedAt/);
  assert.match(route,/tx\.systemLog\.create/);
  assert.match(route,/liveOrg\.activeAy === ay && !allowed\.includes\(liveOrg\.activeTerm\)/);
  assert.doesNotMatch(route,/tx\.collection\.update|tx\.fund\.update|tx\.penalty\.update/);
  const c=src('app/api/mobile/orgs/[org]/write-capabilities/route.ts');
  assert.match(c,/'tenant.settings.manage'/);
  assert.match(src('mobile/src/app/(officer)/_layout.tsx'),/can\('tab-setup'\)/);
  assert.match(src('mobile/src/app/(officer)/academic-calendar.tsx'),/canOfferMobileWrite/);
});
