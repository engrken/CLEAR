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
  assert.match(client, /normalizeMobilePayment\(p\)/);
  assert.match(client, /idempotencyKey: payment\.idempotencyKey/);
  const validator = source('mobile/src/api/financial-validation.ts');
  assert.match(validator, /Number\.isSafeInteger\(input\.amountCentavos\)/);
  assert.match(validator, /idempotencyKey\.length > 128/);
});

test('capability endpoint checks tenant-scoped authentication and denies by default', () => {
  const route = source('app/api/mobile/orgs/[org]/write-capabilities/route.ts');
  assert.match(route, /requireMobileOfficer\(req, org, \[\]\)/);
  assert.match(route, /enabled:\s*false,\s*grants:\s*\[\]/);
});

test('mobile bearer tokens remain bound to active tenant membership', () => {
  const session = source('lib/mobile/session.ts');
  assert.match(session, /officer\.organizationId !== org\.id/);
  assert.match(session, /session\.organizationId !== org\.id/);
  assert.match(session, /session\.tenantUserId !== officer\.id/);
  assert.match(session, /officer\.status !== 'Active'/);
  assert.match(session, /org\.subdomain !== normalizeDepartmentSlug\(orgSlug\)/);
});

test('API query parameters encode both keys and values', () => {
  const client = source('mobile/src/api/http.ts');
  assert.match(client, /encodeURIComponent\(k\).*encodeURIComponent\(String\(v\)\)/);
});

test('server financial-write validator rejects coerced or fractional centavos', () => {
  const http = source('lib/mobile/http.ts');
  assert.match(http, /export function requireFinancialWriteCentavos/);
  assert.match(http, /typeof value !== 'number'/);
  assert.match(http, /!Number\.isSafeInteger\(value\)/);
  assert.match(http, /value <= 0/);
});

test('financial rollout is isolated to one production main payment route', () => {
  const policy = source('lib/mobile/production-readonly.ts');
  const http = source('lib/mobile/http.ts');
  assert.match(policy, /financialWritesEnabled\?: boolean/);
  assert.match(policy, /FINANCIAL_POSTS\.test\(path\)/);
  assert.match(policy, /env\.vercelEnv === 'production' && env\.gitRef === 'main'/);
  assert.match(policy, /env\.financialWritesEnabled === true/);
  assert.match(http, /MOBILE_FINANCIAL_WRITES_ENABLED === 'true'/);
});

test('financial allowlist is anchored to the exact payments endpoint', () => {
  const policy = source('lib/mobile/production-readonly.ts');
  assert.match(policy, /const FINANCIAL_POSTS = new RegExp/);
  assert.match(policy, /payments\$'/);
  assert.match(policy, /FINANCIAL_POSTS\.test\(path\)/);
});
