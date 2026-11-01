import test from 'node:test';
import assert from 'node:assert/strict';
import { canOfferMobileWrite, MOBILE_WRITE_ACTIONS } from '../mobile/src/lib/write-permissions.ts';

test('mobile write controls default deny without a server policy', () => {
  assert.equal(canOfferMobileWrite(undefined, 'collections.create', 'jiecep'), false);
  assert.equal(canOfferMobileWrite({ enabled: false, grants: [{ action: 'collections.create', organization: 'jiecep' }] }, 'collections.create', 'jiecep'), false);
  assert.equal(canOfferMobileWrite({ enabled: true, grants: [] }, 'collections.create', 'jiecep'), false);
});

test('mobile write policy requires exact organization and action grant', () => {
  const policy = { enabled: true, grants: [{ action: 'collections.create', organization: 'jiecep' }] };
  assert.equal(canOfferMobileWrite(policy, 'collections.create', 'jiecep'), true);
  assert.equal(canOfferMobileWrite(policy, 'collections.create', 'other-tenant'), false);
  assert.equal(canOfferMobileWrite(policy, 'receipts.void', 'jiecep'), false);
  assert.equal(canOfferMobileWrite(policy, 'collections.create', ' jiecep'), false);
});

test('every Android write action has a unique explicit identifier', () => {
  assert.equal(new Set(MOBILE_WRITE_ACTIONS).size, MOBILE_WRITE_ACTIONS.length);
  assert.ok(MOBILE_WRITE_ACTIONS.includes('clearance.update'));
  assert.ok(MOBILE_WRITE_ACTIONS.includes('global.tenants.manage'));
});

test('financial write switches stay disabled until server-side authorization is implemented', async () => {
  const { readFileSync } = await import('node:fs');
  const config = readFileSync(new URL('../mobile/src/api/config.ts', import.meta.url), 'utf8');
  assert.match(config, /PAYMENT_WRITES_ENABLED = false/);
  assert.match(config, /MOBILE_BUSINESS_WRITES_ENABLED = false/);
});

test('malformed grants fail closed rather than exposing write controls', () => {
  const invalid = { enabled: true, grants: null };
  assert.equal(canOfferMobileWrite(invalid, 'collections.create', 'jiecep'), false);
  assert.equal(canOfferMobileWrite({ enabled: true, grants: [null] }, 'collections.create', 'jiecep'), false);
});
