import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('scoped Global Administrator provisioning cannot bypass tenant READ_ONLY/FULL', () => {
  const core = read('lib/provisioning/core.ts');
  const service = read('lib/maintenance/service.ts');
  assert.match(service, /assertMaintenanceWritesAllowed\(/);
  assert.match(service, /effectivePolicy\(global, scoped\('tenant:' \+ slug\)\)/);
  assert.match(core, /assertMaintenanceWritesAllowed\(affected\.map\(entry => entry\.subdomain\), tx\)/);
  assert.match(core, /assertMaintenanceWritesAllowed\(\[original\.subdomain\], tx\)/);
  assert.match(core, /assertMaintenanceWritesAllowed\(\[org\.subdomain\], tx\)/);
  assert.match(core, /assertMaintenanceWritesAllowed\(\[\]\)/);
  assert.doesNotMatch(service, /\$executeRaw|\$queryRawUnsafe/);
});
test('web entity and destructive provisioning requests also check target tenant policy', () => {
  const entity = read('app/dashboard/entity/actions.ts');
  const actions = read('app/dashboard/provisions/actions.ts');
  assert.match(entity, /assertMaintenanceWritesAllowed\(session\.subdomain/);
  assert.match(actions, /assertMaintenanceWritesAllowed\(\[org\.subdomain\], tx\)/);
  assert.match(actions, /requireSuperAdmin\(\)/);
});
test('global auth actions cannot use no-JS server action form posts to bypass maintenance', () => {
  const permissions = read('lib/permissions.ts');
  const entitySession = read('lib/entity-session.ts');
  assert.match(permissions, /headerStore\.has\('next-action'\)/);
  assert.match(permissions, /headerStore\.has\('content-type'\)/);
  assert.match(entitySession, /headerStore\.has\('content-type'\)/);
  assert.match(permissions, /maintenanceForTenant\(department\)/);
});
test('legacy financial cutover and tenant localhost URL rewriting remain authoritative', () => {
  const proxy = read('proxy.ts');
  assert.match(proxy, /CLEAR_MAINTENANCE_MODE === 'locked'/);
  assert.match(proxy, /maintenanceForTenant\(tenant\)/);
  assert.match(proxy, /\.localhost\$/);
  assert.match(proxy, /NextResponse\.rewrite\(destination\)/);
  assert.match(proxy, /status: 503/);
});
