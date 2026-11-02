import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isMobileRequestAllowed, canRunMobileTenantUserWrites } from '../lib/mobile/production-readonly.ts';
import { MODULE_CATALOG } from '../mobile/src/lib/module-access.ts';

const source = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const path = '/api/mobile/orgs/jiecep/users';
const prod = { vercelEnv: 'production', gitRef: 'main', tenantUserWritesEnabled: true };

test('all canonical web permission tabs are represented in Android', () => {
  const roles = source('lib/role-permissions.ts');
  const known = Array.from(roles.matchAll(/'tab-[a-z-]+'/g)).map(match => match[0].slice(1,-1));
  assert.deepEqual([...new Set(MODULE_CATALOG.map(m => m.tab))].sort(),
    [...new Set(known)].sort());
  assert.ok(MODULE_CATALOG.every(m => m.webPath?.startsWith('/')));
});

test('non-financial officer management is denied by default and never unlocked by cash write flags', () => {
  assert.equal(isMobileRequestAllowed('POST', path, {}), false);
  assert.equal(isMobileRequestAllowed('POST', path,
    { vercelEnv: 'production', gitRef: 'main', financialWritesEnabled: true, tenantOperationsEnabled: true }), false);
  assert.equal(isMobileRequestAllowed('POST', path, { ...prod, gitRef: 'feature/other' }), false);
  assert.equal(isMobileRequestAllowed('DELETE', path, prod), false);
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/orgs/jiecep/void', prod), false);
  assert.equal(isMobileRequestAllowed('POST', path, prod), true);
  assert.equal(canRunMobileTenantUserWrites({ ...prod, tenantUserWritesEnabled: false }), false);
  assert.equal(canRunMobileTenantUserWrites({
    vercelEnv: 'preview', gitRef: 'feature/android-v1.5.0-write-foundation-20261101',
    tenantUserWritesEnabled: true, localRosterCiOnly: false,
  }), false);
});

test('native account status changes share web admin, role, audit and last admin protections', () => {
  const route = source('app/api/mobile/orgs/[org]/users/route.ts');
  const cap = source('app/api/mobile/orgs/[org]/write-capabilities/route.ts');
  const middleware = source('lib/mobile/http.ts');
  assert.match(route, /requireMobileOfficer\(req, slug, 'tab-users'\)/);
  assert.match(route, /isAdminRole\(ctx.officer.role\)/);
  assert.match(route, /isReservedGlobalAdminEmail\(target.email\)/);
  assert.match(route, /tx\.tenantUser\.count/);
  assert.match(route, /At least one active administrator must remain/);
  assert.match(route, /current\.id === officer\.id/);
  assert.match(route, /expectedUpdatedAt/);
  assert.match(route, /Prisma\.TransactionIsolationLevel\.Serializable/);
  assert.match(route, /tx\.tenantUser\.updateMany/);
  assert.match(route, /tx\.mobileSession\.updateMany/);
  assert.match(route, /tx\.systemLog\.create/);
  assert.match(route, /organizationId: org.id/);
  assert.match(cap, /canRunMobileTenantUserWrites/);
  assert.match(cap, /isAdminRole\(officer.role\)/);
  assert.match(cap, /'tenant.users.status'/);
  assert.match(middleware, /mobileTenantUserWriteEnvironment/);
});

test('officer editing is native, independently role-scoped and leaves financial writes disabled', () => {
  const ui=source('mobile/src/app/(officer)/users.tsx');
  const nav=source('mobile/src/app/(officer)/_layout.tsx');
  const modules=source('mobile/src/app/(officer)/more.tsx');
  const cfg=source('mobile/src/api/config.ts');
  assert.match(ui,/can\('tab-users'\) && isAdministrator\(s.officer.role\)/);
  assert.match(ui,/canOfferMobileWrite/);
  assert.match(ui,/api\.listTenantUsers\(/);
  assert.match(ui,/api\.updateTenantUserStatus\(/);
  assert.match(ui,/expectedUpdatedAt: user.updatedAt/);
  assert.match(ui,/openDepartmentModule\(s.org.subdomain, '\/users'\)/);
  assert.match(nav,/Tabs.Protected guard=\{can\('tab-users'\)\}/);
  assert.match(modules,/tab === 'tab-users' && isTenantAdmin/);
  assert.match(cfg,/PAYMENT_WRITES_ENABLED = false/);
  assert.match(cfg,/REMITTANCE_WRITES_ENABLED = false/);
  assert.match(cfg,/MOBILE_BUSINESS_WRITES_ENABLED = false/);
});
