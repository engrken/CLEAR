// CI-only, zero-credential smoke checks against the isolated Android PR #41 Preview.
// Never test the Production URL here, and never log personal/financial data.
import assert from 'node:assert/strict';

const expectedHost = 'clearsys-git-android-parity-integration-kentbsece-7567.vercel.app';
const base = new URL(process.env.CLEAR_ANDROID_PREVIEW_ORIGIN || 'https://' + expectedHost);
assert.equal(base.protocol, 'https:', 'Only HTTPS Preview is allowed');
assert.equal(base.hostname, expectedHost, 'Refusing to probe Production or another host');
assert.equal(base.pathname, '/', 'Expected deployment origin, not a path');

async function probe(name, path, expected, validate) {
  const url = new URL(path, base);
  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
      cache: 'no-store',
    });
  } catch (e) {
    console.error(`FAIL ${name}: cannot reach Preview (${e.name || 'network error'})`);
    throw e;
  }

  const type = response.headers.get('content-type') || '';
  console.log(`${response.status === expected ? 'PASS' : 'FAIL'} ${name}: HTTP ${response.status} (expected ${expected}); content-type ${type.split(';')[0]}`);
  assert.equal(response.status, expected, `${name}: unexpected HTTP status; check Vercel Deployment Protection and server logs`);
  assert.ok(type.includes('application/json'), `${name}: expected JSON; got ${type || 'no content-type'}, likely deployment protection or a redirect`);
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`${name}: invalid JSON response`);
  }
  if (validate) validate(body);
  return body;
}

const orgs = await probe('Public department directory', '/api/mobile/orgs', 200, (value) => {
  assert.ok(Array.isArray(value), 'directory must be a JSON array');
  assert.ok(value.length > 0, 'Preview should have at least one active test department');
  assert.ok(value.every((o) => typeof o.subdomain === 'string'), 'invalid organization list');
});
const slug = orgs[0].subdomain;
assert.match(slug, /^[a-z0-9][a-z0-9-]*$/, 'unexpected department slug');
await probe('Department metadata', `/api/mobile/orgs/${slug}`, 200);
await probe('Public fee list', `/api/mobile/orgs/${slug}/fees`, 200);
for (const [name, path] of [
  ['Global overview denies anonymous users', '/api/mobile/global/overview'],
  ['Global session denies anonymous users', '/api/mobile/global/auth/session'],
  ['Officer session denies anonymous users', `/api/mobile/orgs/${slug}/auth/session`],
  ['Financial overview denies anonymous users', `/api/mobile/orgs/${slug}/dashboard`],
  ['Ledger denies anonymous users', `/api/mobile/orgs/${slug}/ledger`],
  ['Student roster denies anonymous users', `/api/mobile/orgs/${slug}/students`],
  ['Remittance queue denies anonymous users', `/api/mobile/orgs/${slug}/remittances/pending`],
  ['Remittance detail denies anonymous users', `/api/mobile/orgs/${slug}/remittances/not-a-real-id`],
]) {
  await probe(name, path, 401, (value) => {
    assert.equal(value?.error?.code, 'unauthorized', `${name}: incorrect auth rejection`);
  });
}
console.log('PASS Preview reachable; public reads work and protected endpoints reject unauthenticated access. No financial/student details printed or changed.');
