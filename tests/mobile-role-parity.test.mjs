import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRESET_ROLE_TABS, parseAllowedTabs } from '../lib/role-permissions.ts';
import { MODULE_CATALOG, grantedModules } from '../mobile/src/lib/module-access.ts';

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('mobile lists every module tab defined in the canonical web admin preset', () => {
  const catalog = MODULE_CATALOG.map((mod) => mod.tab);
  assert.equal(new Set(catalog).size, catalog.length, 'duplicate mobile permission key');
  assert.deepEqual([...catalog].sort(), [...PRESET_ROLE_TABS.admin].sort());
});

test('officer UI is filtered by the server supplied effective tab list', () => {
  assert.deepEqual(grantedModules(['tab-students']).map((mod) => mod.tab), ['tab-students']);
  assert.deepEqual(grantedModules([]), []);
  assert.ok(grantedModules(['tab-overview', 'tab-remittances']).every(
    (module) => ['tab-overview', 'tab-remittances'].includes(module.tab)
  ));
  assert.equal(grantedModules(['not-a-tab']).length, 0);
});

test('custom permissions are sanitized exactly as the web parser requires', () => {
  assert.deepEqual(parseAllowedTabs('["tab-students","tab-students","tab-audit","bad"]'),
    ['tab-students', 'tab-audit']);
  assert.deepEqual(parseAllowedTabs('not json'), []);
  assert.deepEqual(parseAllowedTabs(null), []);
});

test('preset grants are not broadened by Android UI', () => {
  for (const role of ['treasurer', 'auditor', 'viewer']) {
    const modules = grantedModules(PRESET_ROLE_TABS[role]);
    assert.deepEqual(modules.map((mod) => mod.tab).sort(), [...PRESET_ROLE_TABS[role]].sort());
    assert.ok(modules.every((mod) => PRESET_ROLE_TABS.admin.includes(mod.tab)));
  }
});

test('department superadmin label is not converted to a global identity', () => {
  const serializer = source('lib/mobile/serialize.ts');
  assert.match(serializer, /role = String\(user\.role/);
  assert.match(serializer, /scope: 'department'/);
  assert.doesNotMatch(serializer, /role.*'superadmin'.*'admin'/);
  const global = source('lib/mobile/global-session.ts');
  assert.match(global, /verifyGlobalAdminSession/);
});

test('mobile route guards are server enforced on the appropriate tab', () => {
  const cases = [
    ['app/api/mobile/orgs/[org]/dashboard/route.ts', 'tab-overview'],
    ['app/api/mobile/orgs/[org]/ledger/route.ts', 'tab-overview'],
    ['app/api/mobile/orgs/[org]/remittances/pending/route.ts', 'tab-remittances'],
    ['app/api/mobile/orgs/[org]/remittances/[id]/route.ts', 'tab-remittances'],
  ];
  for (const [path, tab] of cases) {
    assert.ok(source(path).includes(`requireMobileOfficer(req, slug, '${tab}')`), path);
  }
  const tabs = source('mobile/src/app/(officer)/_layout.tsx');
  for (const tab of ['tab-payment', 'tab-remittances', 'tab-students']) {
    assert.ok(tabs.includes(tab), tab);
  }
  assert.match(tabs, /Tabs\.Protected/);
  const root = source('mobile/src/app/_layout.tsx');
  assert.match(root, /tab-remittances/);
});

test('no Android role can enable financial writes by its permissions alone', () => {
  assert.match(source('mobile/src/api/config.ts'), /PAYMENT_WRITES_ENABLED\s*=\s*false/);
  const http = source('mobile/src/api/http.ts');
  assert.match(http, /recordPayment: \(s, p\) => PAYMENT_WRITES_ENABLED/);
  assert.match(http, /verifyRemittance: \(s, id, p\) => PAYMENT_WRITES_ENABLED/);
  assert.match(http, /invalidateRemittance: \(s, id\) => PAYMENT_WRITES_ENABLED/);
});
