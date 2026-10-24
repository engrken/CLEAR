import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MODULE_CATALOG } from '../mobile/src/lib/module-access.ts';

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
  assert.match(verify, /Android is read-only/);
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
  assert.match(src, /Replay first-time guide/);
  assert.match(src, /Sign in as Global Superadmin/);
  assert.match(src, /router\.push\('\/officer\/tenant-portal'\)/);
  for (const module of MODULE_CATALOG) {
    assert.ok(src.includes("'" + module.tab + "'"), module.tab + ' omitted from navigation groups');
  }
  assert.doesNotMatch(src, /executeVoidTransaction\(|recordPayment\(|submitProof\(/);
});

test('global admin landing does not advertise unavailable provisioning as available', () => {
  const global = read('mobile/src/app/global/index.tsx');
  assert.match(global, /MOBILE_BUSINESS_WRITES_ENABLED \? \(/);
  assert.match(global, /Provisioning and financial transactions remain disabled on Android/);
  assert.match(global, /Open tenant \(read-only\)/);
});
