import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTenantPromotion } from '../lib/global-admin-promotion-policy.ts';

const member = { id:'tenant-a', organizationId:'eng', role:'admin', status:'Active' };
const staff = (overrides={}) => ({ id:'tenant-b', organizationId:'eng', role:'admin',
  status:'Active', email:'other@example.invalid', reservedGlobalAdmin:false, ...overrides });

test('an active tenant admin can be promoted only when another independent active admin remains', () => {
  assert.equal(validateTenantPromotion([member],[staff()]),null);
  assert.match(validateTenantPromotion([member],[]),/last usable administrator/);
  assert.match(validateTenantPromotion([member],[staff({status:'Inactive'})]),/last usable administrator/);
  assert.match(validateTenantPromotion([member],[staff({role:'treasurer'})]),/last usable administrator/);
  assert.match(validateTenantPromotion([member],[staff({reservedGlobalAdmin:true})]),/last usable administrator/);
});

test('non-admin tenant membership can be promoted without replacing tenant administrator', () => {
  assert.equal(validateTenantPromotion([{...member,role:'treasurer'}],[]),null);
});

test('blocked or inactive tenant membership cannot be promoted', () => {
  assert.match(validateTenantPromotion([{...member,status:'Blocked'}],[staff()]),/must be Active/);
  assert.match(validateTenantPromotion([member,{...member,id:'other',organizationId:'science',status:'Inactive'}],[staff()]),/must be Active/);
});

test('multiple department memberships require an independent admin for each admin position', () => {
  const other = {...member,id:'tenant-c',organizationId:'science'};
  assert.match(validateTenantPromotion([member,other],[staff()]),/last usable administrator/);
  assert.equal(validateTenantPromotion([member,other],[staff(),staff({id:'tenant-d',organizationId:'science'})]),null);
});

test('global users must never count as substitute tenant administrators', () => {
  assert.match(validateTenantPromotion([member],[staff({reservedGlobalAdmin:true})]),/last usable administrator/);
});

test('explicit promotion is not defined for an email lacking a tenant record', () => {
  assert.match(validateTenantPromotion([],[]),/No tenant membership/);
});
