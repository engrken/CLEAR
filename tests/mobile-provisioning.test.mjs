import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('web and global mobile tenant lifecycle share one canonical transaction engine', () => {
  const web = file('app/dashboard/provisions/actions.ts');
  const core = file('lib/provisioning/core.ts');
  const api = file('app/api/mobile/global/provisions/route.ts');
  for (const method of [
    'provisionEntityWithTier', 'updateOrganizationTier',
    'updateOrganizationStatus', 'updateOrganizationSchoolGroup',
  ]) {
    assert.ok(web.includes(`${method}Core(await verifiedSuperAdminEmail()`), method);
    assert.ok(core.includes(`export async function ${method}Core(actor: string, `), method);
  }
  assert.match(api, /provisionEntityWithTierCore\(identity\.email,/);
  assert.match(core, /isReservedGlobalAdminEmail\(adminEmail\)/);
  assert.match(core, /TransactionIsolationLevel\.Serializable/);
  assert.match(core, /academicPeriodConfig\.create/);
  assert.match(core, /PRESET_ROLE_TABS\.admin/);
  assert.match(core, /systemLog\.create/);
  assert.match(core, /checkGroupLimit\(existingGroupMembers\.length \+ 1/);
});

test('global provisioning endpoints require registered superadmin bearer session and isolated Preview', () => {
  const paths = [
    'app/api/mobile/global/provisions/route.ts',
    'app/api/mobile/global/provisions/manage/route.ts',
  ];
  for (const path of paths) {
    const route = file(path);
    assert.match(route, /requireGlobalMobileAdmin\(req\)/, path);
    assert.match(route, /requireAndroidProvisioningPreview\(\)/, path);
    assert.doesNotMatch(route, /export const DELETE|export const PATCH|export const PUT/, path);
  }
  const policy = file('lib/mobile/provisioning-policy.ts');
  assert.match(policy, /VERCEL_ENV !== 'preview'/);
  assert.match(policy, /VERCEL_GIT_COMMIT_REF !== 'android-parity-integration'/);
});

test('tenant changes require explicit server-side confirmation, and deletion remains web-only', () => {
  const create = file('app/api/mobile/global/provisions/route.ts');
  const manage = file('app/api/mobile/global/provisions/manage/route.ts');
  assert.match(create, /PROVISION \$\{slug\}/);
  assert.match(manage, /MANAGE \$\{org\.subdomain\}/);
  assert.match(manage, /updateOrganizationTierCore/);
  assert.match(manage, /updateOrganizationStatusCore/);
  assert.match(manage, /updateOrganizationSchoolGroupCore/);
  assert.doesNotMatch(manage, /deleteOrganization|\.delete\(/);
  assert.doesNotMatch(create, /deleteOrganization|\.delete\(/);
});

test('global provisioning screens are guarded and officer overview remains role-based', () => {
  const nav = file('mobile/src/app/_layout.tsx');
  for (const path of ['global/provisions/index','global/provisions/new','global/provisions/[id]']) {
    assert.ok(nav.includes(path), path);
  }
  const globals = nav.indexOf('guard={!!globalSession && !session}');
  assert.ok(globals >= 0 && nav.indexOf('global/provisions/new',globals) > globals);
  const home = file('mobile/src/app/(officer)/home.tsx');
  assert.match(home, /can\('tab-overview'\)/);
  const api = file('mobile/src/api/http.ts');
  assert.match(api, /listManagedTenants: /);
  assert.match(api, /provisionTenant: /);
  assert.match(api, /manageTenant: /);
  assert.match(file('mobile/src/api/config.ts'), /PAYMENT_WRITES_ENABLED\s*=\s*false/);
});
