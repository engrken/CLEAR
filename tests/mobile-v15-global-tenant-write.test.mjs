import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canRunMobileGlobalTenantOperations,isMobileRequestAllowed} from '../lib/mobile/production-readonly.ts';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('global tenant native management is server opted-in, not activated by Android flags',()=>{
 assert.equal(canRunMobileGlobalTenantOperations({vercelEnv:'production',gitRef:'main'}),false);
 assert.equal(canRunMobileGlobalTenantOperations({vercelEnv:'production',gitRef:'main',tenantOperationsEnabled:true}),true);
 assert.equal(canRunMobileGlobalTenantOperations({vercelEnv:'preview',gitRef:'untrusted',tenantOperationsEnabled:true}),false);
 assert.equal(isMobileRequestAllowed('POST','/api/mobile/global/provisions',
  {vercelEnv:'production',gitRef:'main',tenantOperationsEnabled:true}),true);
 assert.equal(isMobileRequestAllowed('POST','/api/mobile/orgs/jiecep/payments',
  {vercelEnv:'production',gitRef:'main',tenantOperationsEnabled:true}),false);
});
test('native write controls and backend require real Global Administrator session',()=>{
 const route=src('app/api/mobile/global/write-capabilities/route.ts');
 assert.match(route,/requireGlobalMobileAdmin\(req\)/);
 assert.match(route,/canRunMobileGlobalTenantOperations/);
 assert.match(src('mobile/src/app/global/provisions/new.tsx'),/operations\.data\?\.tenantOperationsEnabled/);
 assert.match(src('mobile/src/app/global/provisions/\[id\].tsx'),/operations\.data\?\.tenantOperationsEnabled/);
 assert.match(src('app/api/mobile/global/provisions/manage/route.ts'),/requireAndroidProvisioningPreview/);
 assert.match(src('app/api/mobile/global/provisions/route.ts'),/requireAndroidProvisioningPreview/);
});
