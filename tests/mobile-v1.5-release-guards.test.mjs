import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('global administrator account is a protected native route', () => {
  const layout = source('mobile/src/app/_layout.tsx');
  const account = source('mobile/src/app/global/account.tsx');
  const dashboard = source('mobile/src/app/global/index.tsx');
  assert.match(layout, /guard=\{!!globalSession && !session\}/);
  assert.match(layout, /name="global\/account"/);
  assert.match(dashboard, /router\.push\("\/global\/account"\)/);
  assert.match(account, /useGlobalSession\(\)/);
  assert.match(account, /signOut\(\)/);
});

test('mobile financial writes remain disabled until actual server handlers are reviewed', () => {
  const config = source('mobile/src/api/config.ts');
  assert.match(config, /PAYMENT_WRITES_ENABLED = false/);
  assert.match(config, /MOBILE_BUSINESS_WRITES_ENABLED = false/);
});

test('payment posting requires idempotency and integer centavos before network call', () => {
  const types = source('mobile/src/api/types.ts');
  assert.match(types, /orNumber: string; idempotencyKey: string/);
  const client = source('mobile/src/api/http.ts');
  assert.match(client, /!p\.idempotencyKey\?\.trim\(\)/);
  assert.match(client, /Number\.isSafeInteger\(p\.amountCentavos\)/);
  assert.match(client, /idempotencyKey: p\.idempotencyKey/);
});

test('capability endpoint checks tenant-scoped authentication and denies by default', () => {
  const route = source('app/api/mobile/orgs/[org]/write-capabilities/route.ts');
  assert.match(route, /requireMobileOfficer\(req, org, \[\]\)/);
  assert.match(route, /enabled: false, grants: \[\]/);
});
