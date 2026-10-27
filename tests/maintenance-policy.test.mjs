import test from 'node:test';
import assert from 'node:assert/strict';
import { activeMode, effectivePolicy, tenantSlugFromPath, tenantFromLocation, requestDecision,
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

test('officer and student OTP authentication is allowed only in read-only mode', () => {
  for (const suffix of ['/auth/request-code','/auth/verify-code',
    '/clearance/auth/request-code','/clearance/auth/verify-code']) {
    const path = '/api/mobile/orgs/jiecep' + suffix;
    assert.equal(requestDecision('READ_ONLY','POST',path),'ALLOW');
    assert.equal(requestDecision('FULL','POST',path),'FULL_BLOCK');
  }
  for(const path of ['/api/mobile/orgs/jiecep/payments',
    '/api/mobile/orgs/jiecep/profile/email/confirm',
    '/api/mobile/orgs/jiecep/clearance/email-change/confirm']) {
    assert.equal(requestDecision('READ_ONLY','POST',path),'READ_ONLY_BLOCK');
  }
});
test('recovery exception cannot be broadened to hidden control subpaths', () => {
  assert.equal(isRecoveryPath('/dashboard/provisions/maintenance/backdoor'),false);
  assert.equal(isRecoveryPath('/api/mobile/global/provisions/manage'),false);
});

test('maintenance banner and proxy resolve tenant consistently across web navigation', () => {
  assert.equal(tenantFromLocation('/department/jiecep/clearance','clearsys.vercel.app'),'jiecep');
  assert.equal(tenantFromLocation('/department/betatester','clearsys.vercel.app'),'betatester');
  assert.equal(tenantFromLocation('/','engineering.localhost'),'engineering');
  assert.equal(tenantFromLocation('/dashboard','www.localhost'),null);
  assert.equal(tenantFromLocation('/dashboard','clearsys.vercel.app'),null);
  assert.equal(tenantFromLocation('/department/jiecep','engineering.localhost'),'jiecep');
});


test('web OTP challenge is narrowly allowed for POST only during READ_ONLY', () => {
  const route = '/api/department/jiecep/auth/request-code';
  assert.equal(requestDecision('READ_ONLY','POST',route),'ALLOW');
  assert.equal(requestDecision('NORMAL','POST',route),'ALLOW');
  assert.equal(requestDecision('FULL','POST',route),'FULL_BLOCK');
  for (const method of ['PUT','PATCH','DELETE']) {
    assert.equal(requestDecision('READ_ONLY',method,route),'READ_ONLY_BLOCK');
  }
  for (const path of [
    '/department/jiecep',
    '/department/jiecep/collections',
    '/api/department/jiecep/auth/request-code/anything',
    '/api/department/jiecep/auth/modify',
    '/api/department/jiecep/transactions',
  ]) {
    assert.equal(requestDecision('READ_ONLY','POST',path),'READ_ONLY_BLOCK',path);
  }
  assert.equal(isRecoveryPath(route),false,
    'Web OTP challenge must NOT bypass GLOBAL FULL operator-only recovery');
  assert.equal(tenantSlugFromPath(route),'jiecep');
});
