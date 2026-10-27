import test from 'node:test';
import assert from 'node:assert/strict';
import { activeMode, effectivePolicy, tenantSlugFromPath, requestDecision,
  isRecoveryPath, NORMAL } from '../lib/maintenance/rules.ts';

const at = new Date('2026-10-27T09:00:00.000Z');
const row = (mode, scope='GLOBAL', expiresAt=null) =>
  ({ mode, scope, reason: 'Scheduled test maintenance', updatedAt: at, expiresAt });

test('missing and expired maintenance policy evaluate NORMAL OFF', () => {
  assert.equal(effectivePolicy(null,null,at).mode,'NORMAL');
  assert.equal(activeMode(null,at).mode,'NORMAL');
  assert.equal(effectivePolicy(row('FULL','GLOBAL',new Date(at.getTime()-1)),null,at).mode,'NORMAL');
  assert.equal(NORMAL.mode,'NORMAL');
});
test('global active policy overrides tenant-specific mode', () => {
  assert.equal(effectivePolicy(row('FULL'),row('READ_ONLY','tenant:jiecep'),at).mode,'FULL');
  assert.equal(effectivePolicy(row('READ_ONLY'),row('FULL','tenant:jiecep'),at).mode,'READ_ONLY');
  assert.equal(effectivePolicy(null,row('READ_ONLY','tenant:jiecep'),at).mode,'READ_ONLY');
  assert.equal(effectivePolicy(row('NORMAL'),row('FULL','tenant:jiecep'),at).mode,'FULL');
});
test('tenant routes derive from path, not spoofed query or headers', () => {
  for(const path of ['/department/jiecep/collections','/api/department/jiecep/payment',
    '/api/mobile/orgs/jiecep/ledger', '/api/mobile/global/orgs/jiecep/ledger'])
    assert.equal(tenantSlugFromPath(path),'jiecep');
  for(const path of ['/api/mobile/global/overview','/dashboard','/','/api/cron/send'])
    assert.equal(tenantSlugFromPath(path),null);
  assert.equal(tenantSlugFromPath('/department/%2Fmalicious'),null);
});
test('financial writes and server action POSTs blocked in read-only/full', () => {
  for(const method of ['POST','PUT','PATCH','DELETE']) {
    assert.equal(requestDecision('READ_ONLY',method,'/department/jiecep/collections'),'READ_ONLY_BLOCK');
    assert.equal(requestDecision('READ_ONLY',method,'/api/mobile/orgs/jiecep/payments'),'READ_ONLY_BLOCK');
  }
  assert.equal(requestDecision('READ_ONLY','GET','/department/jiecep/collections'),'ALLOW');
  assert.equal(requestDecision('FULL','GET','/department/jiecep/collections'),'FULL_BLOCK');
  assert.equal(requestDecision('FULL','POST','/api/mobile/orgs/jiecep/payments'),'FULL_BLOCK');
  assert.equal(requestDecision('NORMAL','POST','/department/jiecep/collections'),'ALLOW');
});
test('recovery exception paths are narrow', () => {
  for(const path of ['/api/maintenance/status','/maintenance',
    '/dashboard/provisions/maintenance','/api/auth/session']) {
    assert.ok(isRecoveryPath(path));
    assert.equal(requestDecision('FULL','GET',path),'ALLOW');
  }
  for(const path of ['/department/jiecep/collections','/api/maintenance/reconfigure',
    '/dashboard/provisions/maintenance-forged','/api/mobile/orgs/jiecep/payments'])
    assert.equal(isRecoveryPath(path),false);
});
