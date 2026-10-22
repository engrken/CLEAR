import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isMobileRequestAllowed } from '../lib/mobile/production-readonly.ts';
import { normalizePresencePage, presencePageKey, PRESENCE_TABS } from '../lib/collaboration-pages.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const production = { vercelEnv: 'production', gitRef: 'main' };

test('presence validates a known module and exact term instead of taking an arbitrary path', () => {
  assert.equal(normalizePresencePage('overview'), 'overview');
  assert.equal(normalizePresencePage('collections'), 'collections');
  assert.equal(normalizePresencePage('__proto__'), null);
  assert.equal(normalizePresencePage('../students'), null);
  assert.equal(normalizePresencePage(''), null);
  assert.equal(PRESENCE_TABS.collections, 'tab-payment');
  assert.equal(PRESENCE_TABS.remittances, 'tab-remittances');
  assert.notEqual(presencePageKey('students', 'AY 2026', '1st Sem'), presencePageKey('students', 'AY 2026', '2nd Sem'));
  assert.equal(presencePageKey('students', '', '1st Sem'), null);
  assert.equal(presencePageKey('students', 'AY 2026', ''.padEnd(90, 'a')), null);
});

test('web presence never trusts a claimed name, tenant or module permission from the browser', () => {
  const route = read('app/api/department/[department]/presence/route.ts');
  const service = read('lib/collaboration-service.ts');
  assert.match(route, /requireTabAccess\(PRESENCE_TABS\[page\], department\)/);
  assert.match(route, /requireOrgAdmin\(department\)/);
  assert.match(route, /actor\.organizationId, userId: actor\.id/);
  assert.doesNotMatch(route, /body\.organizationId|body\.name|body\.userId/);
  assert.match(service, /organizationId: input\.organizationId, tenantUserId: input\.userId/);
  assert.match(service, /lastSeen: \{ gte: new Date\(Date\.now\(\) - PRESENCE_TTL_MS\) \}/);
  assert.match(service, /officer: \{ status: 'Active', organizationId \}/);
  assert.match(service, /row\.tenantUserId === currentUserId/);
  assert.match(service, /new Set<string>\(\)/);
});

test('web and Android share the same presence data with short-lived heartbeats', () => {
  const web = read('app/department/[department]/components/DepartmentPresenceAndTour.tsx');
  const android = read('mobile/src/components/collaboration/OfficerPresence.tsx');
  const mobileRoute = read('app/api/mobile/orgs/[org]/presence/route.ts');
  assert.match(web, /crypto\.randomUUID\(\)/);
  assert.match(web, /setInterval\(\(\) => void pulse\(\), 30_000\)/);
  assert.match(web, /document\.visibilityState !== 'visible'/);
  assert.match(web, /pagehide/);
  assert.match(web, /title=\{person\.name\}/);
  assert.match(android, /api\.pulseOfficerPresence\(session, page, tabId\)/);
  assert.match(android, /api\.leaveOfficerPresence\(session, tabId\)/);
  assert.match(android, /AppState\.addEventListener/);
  assert.match(android, /Alert\.alert\('Officer currently on this page', user\.name\)/);
  assert.match(mobileRoute, /requireMobileOfficer\(req, slug,/);
  assert.match(mobileRoute, /page === 'students' \? \['tab-students', 'tab-payment'\]/);
  assert.doesNotMatch(mobileRoute, /export const PUT|export const PATCH/);
});

test('versioned, server-persisted onboarding reappears on role/permission changes and exempts superadmins', () => {
  const service = read('lib/collaboration-service.ts');
  const webRoute = read('app/api/department/[department]/onboarding/route.ts');
  const mobileRoute = read('app/api/mobile/orgs/[org]/onboarding/route.ts');
  const web = read('app/department/[department]/components/DepartmentPresenceAndTour.tsx');
  const mobile = read('mobile/src/components/collaboration/OfficerWalkthrough.tsx');
  assert.match(service, /clear-walkthrough-v1/);
  assert.match(service, /\[\.\.\.new Set\(tabs\)\]\.sort\(\)/);
  assert.match(service, /onboardingSignature: onboardingSignature\(role, tabs\)/);
  assert.match(service, /role\.trim\(\)\.toLowerCase\(\) === 'superadmin'/);
  assert.match(webRoute, /requireTenantMember\(department\)/);
  assert.match(mobileRoute, /requireMobileOfficer\(req, slug, null\)/);
  assert.match(web, /setServerGrantedTabs\(Array\.isArray\(data\.tabs\)/);
  assert.match(web, /serverGrantedTabs\.includes\(m\.tab\)/);
  assert.match(web, /clear_privacy_accepted/);
  assert.match(mobile, /result\.tabs/);
  assert.match(mobile, /clear_privacy_notice_ack_v1/);
  assert.match(mobile, /MODULES\.filter\(m => tabs\.includes\(m\.tab\)\)/);
});

test('production Android permits only exact collaboration metadata operations, not arbitrary writes', () => {
  for (const suffix of ['/presence', '/onboarding']) {
    const path = '/api/mobile/orgs/jiecep' + suffix;
    assert.equal(isMobileRequestAllowed('POST', path, production), true);
    assert.equal(isMobileRequestAllowed('PATCH', path, production), false);
    assert.equal(isMobileRequestAllowed('PUT', path, production), false);
    assert.equal(isMobileRequestAllowed('DELETE', path, production), suffix === '/presence');
  }
  for (const bad of ['/presence/impersonate','/onboarding/roles','/payments','/expenses','/financials']) {
    assert.equal(isMobileRequestAllowed('POST', '/api/mobile/orgs/jiecep'+bad, production), false);
  }
});

test('high-impact web operations have cancel-first confirmation before the write', () => {
  const paths = [
    ['app/department/[department]/(protected)/collections/CollectionsForm.tsx', 'recordPayment'],
    ['app/department/[department]/(protected)/advances/AdvancesForm.tsx', 'issueCashAdvance'],
    ['app/department/[department]/(protected)/liquidations/LiquidationsForm.tsx', 'recordAudit'],
    ['app/department/[department]/(protected)/remittances/RemittanceVerificationQueue.tsx', 'verifyOnlineRemittance'],
    ['app/department/[department]/(protected)/penalties/PenaltiesManager.tsx', 'recordPenalty'],
    ['app/department/[department]/(protected)/users/UserManagementClient.tsx', 'saveTenantUser'],
    ['app/department/[department]/(protected)/students/StudentsClient.tsx', 'saveStudent'],
    ['app/department/[department]/(protected)/setup/SetupClient.tsx', 'saveInitialFunds'],
  ];
  for (const [file, mutation] of paths) {
    const s = read(file);
    assert.ok(s.includes('confirmCommittedChange({'), file);
    assert.ok(s.indexOf('confirmCommittedChange({') < s.indexOf('await '+mutation+'('), file+' must confirm before committing');
  }
  const dialog = read('lib/clear-dialogs.ts');
  assert.match(dialog, /focusCancel: true/);
  assert.match(dialog, /showCancelButton: true/);
  assert.match(dialog, /consequence/);
  assert.match(dialog, /allowOutsideClick: false/);
});

test('schema has foreign-keyed presence, role-version signature, and dedicated migration', () => {
  const schema = read('prisma/schema.prisma');
  const migration = read('prisma/migrations/20261023100000_officer_presence_onboarding/migration.sql');
  assert.match(schema, /model OfficerPagePresence \{/);
  assert.match(schema, /onboardingSignature String\?/);
  assert.match(schema, /@@index\(\[organizationId, pageKey, lastSeen\]\)/);
  assert.match(migration, /REFERENCES "TenantUser"\("id"\)/);
  assert.match(migration, /ADD COLUMN "onboardingSignature"/);
});
