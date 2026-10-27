import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveMaintenance, emergencyEnvironmentMode, maintenanceRequestAllowed } from '../lib/maintenance-policy.ts';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const when = new Date('2026-11-10T10:00:00.000Z');
const make = (id,scope,tenantId,mode,starts='2026-11-10T09:00:00.000Z',ends='2026-11-10T12:00:00.000Z') =>
  ({ id,enabled:true,scope,tenantId,mode,startsAt:new Date(starts),endsAt:new Date(ends),reason:'Scheduled maintenance' });

test('normal baseline never accidentally turns maintenance on',()=>{
  assert.equal(emergencyEnvironmentMode(undefined),'normal');
  assert.equal(emergencyEnvironmentMode('true'),'normal');
  assert.equal(emergencyEnvironmentMode('locked'),'full');
  assert.equal(resolveMaintenance([],when,'a').mode,'normal');
  assert.equal(resolveMaintenance([make('t','tenant','a','full')],when,'b').mode,'normal');
});

test('effective maintenance respects UTC start/end, explicit enable and global precedence',()=>{
  const t=make('tenant','tenant','a','full');
  const g=make('global','global',null,'read_only');
  assert.equal(resolveMaintenance([t,g],when,'a').mode,'read_only','global outranks tenant even if less restrictive');
  assert.equal(resolveMaintenance([t],when,'a').mode,'full');
  assert.equal(resolveMaintenance([t],new Date('2026-11-10T08:59:59.000Z'),'a').mode,'normal');
  assert.equal(resolveMaintenance([t],new Date('2026-11-10T12:00:00.000Z'),'a').mode,'normal');
  assert.equal(resolveMaintenance([{...t,enabled:false}],when,'a').mode,'normal');
  assert.equal(resolveMaintenance([{...t,startsAt:new Date('bad')}],when,'a').mode,'normal');
  assert.equal(resolveMaintenance([{...t,endsAt:new Date('2026-11-10T08:00:00.000Z')}],when,'a').mode,'normal');
});

test('read-only blocks every mutation including API POST and Next Server Action',()=>{
  for (const method of ['POST','PATCH','PUT','DELETE']) {
    for (const path of ['/api/mobile/orgs/jiecep/payments','/department/jiecep/collections',
      '/api/mobile/orgs/jiecep/auth/request-code']) {
      assert.equal(maintenanceRequestAllowed('read_only',method,path),false);
    }
  }
  assert.equal(maintenanceRequestAllowed('read_only','GET','/api/mobile/orgs/jiecep/ledger'),true);
  assert.equal(maintenanceRequestAllowed('normal','POST','/api/mobile/orgs/jiecep/payments'),true);
});

test('full maintenance denies private API GET, OTP and mutations but allows public status page',()=>{
  for(const path of ['/api/mobile/orgs/jiecep/ledger','/department/jiecep/students','/dashboard']){
    assert.equal(maintenanceRequestAllowed('full','GET',path),false);
  }
  assert.equal(maintenanceRequestAllowed('full','GET','/api/maintenance/status'),true);
  assert.equal(maintenanceRequestAllowed('full','GET','/maintenance'),true);
  assert.equal(maintenanceRequestAllowed('full','POST','/api/maintenance/status'),false);
  assert.equal(maintenanceRequestAllowed('full','DELETE','/maintenance'),false);
});

test('public stage 1 status is noncached; emergency proxy allows GET status only',()=>{
  const status=read('app/api/maintenance/status/route.ts');
  const proxy=read('proxy.ts');
  assert.match(status,/emergencyEnvironmentMode\(process\.env\.CLEAR_MAINTENANCE_MODE\)/);
  assert.match(status,/no-store, no-cache, must-revalidate/);
  assert.match(proxy,/pathname === '\/api\/maintenance\/status'/);
  assert.match(proxy,/request\.method === 'GET'/);
  assert.doesNotMatch(status,/GlobalAdmin|TenantUser|adminEmail|studentId|organizationId|prisma\./);
});
