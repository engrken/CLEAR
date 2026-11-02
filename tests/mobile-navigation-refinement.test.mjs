import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MODULE_CATALOG } from '../mobile/src/lib/module-access.ts';
import { filterRecentActivity } from '../mobile/src/lib/recent-activity-search.ts';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('student portal prioritizes OTP clearance and does not navigate to disabled payment-proof flow', () => {
  const portal = read('mobile/src/app/d/[dept]/index.tsx');
  const root = read('mobile/src/app/_layout.tsx');
  assert.match(portal, /title="Check my clearance"/);
  assert.match(portal, /Verify your registered email to check your private clearance status/);
  assert.match(portal, /MOBILE_BUSINESS_WRITES_ENABLED \? \(/);
  assert.match(portal, /Proof uploads are unavailable in this Android release/);
  assert.doesNotMatch(portal, /See if you’re cleared and get your QR code/);
  assert.match(root, /Stack\.Protected guard=\{MOBILE_BUSINESS_WRITES_ENABLED\}/);
  assert.match(root, /<Stack\.Screen name="d\/\[dept\]\/clearance"/);
});

test('public students can discover and filter organizations without searching private roster data', () => {
  const root = read('mobile/src/app/index.tsx');
  const orgs = read('mobile/src/app/organizations.tsx');
  assert.match(root, /Find my department/);
  assert.match(root, /Verify your registered email/);
  assert.match(orgs, /onChangeText=\{setSearch\}/);
  assert.match(orgs, /org\.name\.toLowerCase\(\)\.includes\(query\)/);
  assert.match(orgs, /org\.subdomain\.toLowerCase\(\)\.includes\(query\)/);
  assert.doesNotMatch(orgs, /listStudents|getOwnClearance|requestStudentClearanceCode/);
});

test('officer bottom tabs hide paused Collect and label remittance review clearly', () => {
  const tabs = read('mobile/src/app/(officer)/_layout.tsx');
  const config = read('mobile/src/api/config.ts');
  assert.match(config, /PAYMENT_WRITES_ENABLED = false/);
  assert.match(tabs, /PAYMENT_WRITES_ENABLED && can\('tab-payment'\)/);
  assert.match(tabs, /guard=\{can\('tab-payment'\) && PAYMENT_WRITES_ENABLED\}/);
  assert.match(tabs, /name: 'verify', title: 'Review'/);
  assert.match(tabs, /name: 'more', title: 'Modules'/);
  const verify = read('mobile/src/app/(officer)/verify.tsx');
  assert.match(verify, /audited web workflow/);
});

test('module directory groups every canonical module, displays only server-authorized grants and never routes web-only actions', () => {
  const src = read('mobile/src/app/(officer)/more.tsx');
  assert.match(src, /grantedModules\(session\.officer\.allowedTabs\)/);
  assert.match(src, /Find an assigned module/);
  assert.match(src, /Search my modules/);
  assert.match(src, /Students & clearance/);
  assert.match(src, /Payments & finance/);
  assert.match(src, /Reports & administration/);
  assert.match(src, /m\.availability === 'available' \|\| m\.availability === 'review-only'/);
  assert.match(src, /action = m\.availability === 'available' \|\| m\.availability === 'review-only'/);
  assert.match(src, /openDepartmentModule\(session\.org\.subdomain, m\.webPath!\)/);
  assert.match(src, /Replay first-time guide/);
  assert.match(src, /Sign in as Global Administrator/);
  assert.match(src, /router\.push\('\/officer\/tenant-portal'\)/);
  for (const module of MODULE_CATALOG) {
    assert.ok(src.includes("'" + module.tab + "'"), module.tab + ' omitted from navigation groups');
    assert.ok(module.webPath?.startsWith('/'), module.tab + ' missing secure web counterpart');
  }
  const links = read('mobile/src/lib/links.ts');
  assert.match(links, /WEB_MODULE_PATHS\.has\(route\)/);
  assert.match(links, /https:\/\/clearsys\.vercel\.app/);
  assert.doesNotMatch(links, /Authorization:|Bearer |studentToken/);
  assert.doesNotMatch(src, /executeVoidTransaction\(|recordPayment\(|submitProof\(/);
});

test('global admin landing does not advertise unavailable provisioning as available', () => {
  const global = read('mobile/src/app/global/index.tsx');
  assert.match(global, /operations\.data\?\.tenantOperationsEnabled \? \(/);
  assert.match(global, /api\.getGlobalManagementCapabilities\(global\)/);
  const grantRoute = read('app/api/mobile/global/write-capabilities/route.ts');
  assert.match(grantRoute, /requireGlobalMobileAdmin\(req\)/);
  assert.match(grantRoute, /canRunMobileGlobalTenantOperations/);
  assert.match(global, /Switch to Web Portal/);
  assert.match(global, /openVerifiedWebHandoff\(url\)/);
  assert.match(global, /switchToGlobalWebPortal\(\)/);
  assert.match(global, /Open tenant activity/);
});

test('bounded Activity searches filter only supplied role-authorized rows, including historical OR suffixes', () => {
  const records = [
    { kind: 'collection', id: 'a', title: 'Test Student A', reference: 'OR-101-P02', receiptNumber: 'OR-101', subtitle: 'Package', status: 'Valid', amountCentavos: 100, at: '2026-10-01T00:00:00.000Z' },
    { kind: 'collection', id: 'b', title: 'Test Student B', reference: 'OR-102', subtitle: 'Fee', status: 'Voided', amountCentavos: 0, at: '2026-10-02T00:00:00.000Z' },
    { kind: 'penalty', id: 'c', title: 'Test Student C', reference: 'P-3', subtitle: 'Penalty', status: 'Voided', amountCentavos: 100, at: '2026-10-03T00:00:00.000Z' },
  ];
  assert.deepEqual(filterRecentActivity(records, 'or-101').map(r => r.id), ['a']);
  assert.deepEqual(filterRecentActivity(records, ' student b ').map(r => r.id), ['b']);
  assert.deepEqual(filterRecentActivity(records, '', 'receipts').map(r => r.id), ['a', 'b']);
  assert.deepEqual(filterRecentActivity(records, '', 'voided').map(r => r.id), ['b']);
  assert.deepEqual(filterRecentActivity(records, 'never-issued').map(r => r.id), []);
  assert.equal(records.length, 3, 'filtering must not mutate or fetch records');
});

test('officer and global Activity search only the authorized loaded batch and do not expose posting actions', () => {
  const global = read('mobile/src/app/global/tenant/[org].tsx');
  const home = read('mobile/src/app/(officer)/home.tsx');
  const helper = read('mobile/src/lib/recent-activity-search.ts');
  assert.match(global, /filterRecentActivity\(/);
  assert.match(home, /filterRecentActivity\(/);
  assert.match(global, /onChangeText=\{setSearch\}/);
  assert.match(home, /onChangeText=\{setLedgerQuery\}/);
  assert.match(global, /selected\.data \?\? \[\]/);
  assert.match(home, /ledger\.data \?\? \[\]/);
  assert.match(helper, /kind === 'voided'/);
  assert.match(helper, /row\.kind !== 'collection'/);
  assert.doesNotMatch(helper, /fetch\(|request\(|update\(|delete\(/);
  assert.match(home, /can\('tab-overview'\)/);
  assert.match(home, /can\('tab-payment'\)/);
  assert.match(home, /can\('tab-void'\)/);
  const reference = read('mobile/src/app/(officer)/reference-search.tsx');
  assert.match(home, /router.push\(\{ pathname: '\/reference-search'/);
  assert.match(reference, /openDepartmentModule\(s\.org\.subdomain,'\/collections\/history'\)/);
  assert.match(reference, /openDepartmentModule\(s\.org\.subdomain,'\/void'\)/);
  assert.match(reference, /api\.searchReceiptReferences\(/);
  assert.match(reference, /api\.searchVoidReferences\(/);
  assert.match(global, /useGlobalSession\(\)/);
});
