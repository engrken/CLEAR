import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = (path) => new URL('../' + path, import.meta.url);
const read = (path) => readFileSync(root(path), 'utf8');

// Safe interim Android integration state. Future work may deliberately replace
// these guards only after the mobile payment/remittance endpoints reuse the
// canonical web financial transaction service, have tenant authorization and
// durable idempotency, and pass isolated integration tests.
test('Android client financial writes stay disabled until canonical web parity is certified', () => {
  const config = read('mobile/src/api/config.ts');
  const client = read('mobile/src/api/http.ts');
  assert.match(config, /export const PAYMENT_WRITES_ENABLED = false\s*;/);
  assert.match(client, /recordPayment:\s*\(s, p\) => \{\s*if \(!PAYMENT_WRITES_ENABLED\)/);
  assert.match(client, /verifyRemittance:\s*\(s, id, p\) => PAYMENT_WRITES_ENABLED \?/);
  assert.match(client, /invalidateRemittance:\s*\(s, id\) => PAYMENT_WRITES_ENABLED \?/);
});

test('Android payment API is authenticated and gated; other financial writes remain blocked', () => {
  const routePath = 'app/api/mobile/orgs/[org]/payments/route.ts';
  assert.equal(existsSync(root(routePath)), true, 'Payment route must exist for isolated integration testing');
  const route = read(routePath);
  assert.match(route, /requireMobileOfficer\(req, slug, 'tab-payment'\)/);
  assert.match(route, /requireFinancialWriteCentavos\(body\.amountCentavos/);
  assert.match(route, /postAuthorizedPayment\(org\.subdomain/);
  const policy = read('lib/mobile/production-readonly.ts');
  assert.match(policy, /env\.vercelEnv === 'production' && env\.gitRef === 'main'/);
  assert.match(policy, /env\.financialWritesEnabled === true/);
  for (const path of [
    'app/api/mobile/orgs/[org]/remittances/[id]/verify/route.ts',
    'app/api/mobile/orgs/[org]/remittances/[id]/invalidate/route.ts',
  ]) {
    assert.equal(existsSync(root(path)), false, `Unexpected remittance write route: ${path}`);
  }
  const proofs = read('app/api/mobile/orgs/[org]/proofs/route.ts');
  assert.match(proofs, /temporarily_unavailable/);
  assert.match(proofs, /throw new ApiFailure\(503/);
});

test('Android must not invent or accept a user-selected OR when financial writes are implemented', () => {
  const current = read('lib/financial/authorized-payment.ts');
  const web = read('app/department/[department]/(protected)/collections/actions.ts');
  const mobile = read('mobile/src/api/http.ts');
  assert.match(current, /allocateOfficialReceiptNumber\(tx, org\.id\)/);
  assert.match(current, /tx\.paymentRequest\.findUnique/);
  // This is an intentionally disabled legacy client payload. Do not turn
  // PAYMENT_WRITES_ENABLED on until the mobile API no longer depends on this
  // untrusted OR field and uses the canonical web-generated receipt number.
  assert.doesNotMatch(mobile, /orNumber:\s*p\.orNumber/);
  assert.match(web, /return postAuthorizedPayment\(cleanDepartment, data, officer\)/);
  assert.match(read('app/api/mobile/orgs/[org]/payments/route.ts'), /orNumber:\s*result\.orNumber/);
  assert.match(read('mobile/src/api/config.ts'), /PAYMENT_WRITES_ENABLED = false/);
});
