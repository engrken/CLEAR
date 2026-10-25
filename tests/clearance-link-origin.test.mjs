import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clearanceLinkOrigin } from '../lib/clearance-link-origin.ts';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const OFFICIAL = 'https://clearsys.vercel.app';

test('Production certificate links are pinned to the official domain', () => {
  for (const authUrl of [
    undefined,
    'https://attacker.example',
    'https://clearsys.vercel.app',
    'http://localhost:3000',
  ]) {
    assert.equal(clearanceLinkOrigin({
      vercelEnv: 'production', nodeEnv: 'production',
      vercelUrl: 'evil.vercel.app', authUrl,
    }), OFFICIAL);
  }
});

test('Preview certificate links use only a validated server-supplied Vercel deployment', () => {
  assert.equal(clearanceLinkOrigin({
    vercelEnv: 'preview', nodeEnv: 'production',
    vercelUrl: 'clear-preview-123.vercel.app',
  }), 'https://clear-preview-123.vercel.app');
  for (const candidate of [
    'attacker.example',
    'evil.vercel.app@attacker.example',
    'clear-preview-123.vercel.app/path',
    'clear-preview-123.vercel.app:8080',
  ]) {
    assert.equal(clearanceLinkOrigin({
      vercelEnv: 'preview', nodeEnv: 'production', vercelUrl: candidate,
    }), OFFICIAL, 'reject untrusted Preview hostname ' + candidate);
  }
});

test('Local/CI origin uses explicitly configured loopback HTTP, never public HTTP', () => {
  assert.equal(clearanceLinkOrigin({
    nodeEnv: 'production', authUrl: 'http://127.0.0.1:3112',
  }), 'http://127.0.0.1:3112');
  assert.equal(clearanceLinkOrigin({
    nodeEnv: 'development',
  }), 'http://localhost:3000');
  assert.equal(clearanceLinkOrigin({
    nodeEnv: 'production', authUrl: 'http://attacker.example',
  }), OFFICIAL);
  assert.equal(clearanceLinkOrigin({
    nodeEnv: 'production', authUrl: 'https://good.example/path?sig=foo',
  }), OFFICIAL, 'no arbitrary configured path/query in certificate origin');
  assert.equal(clearanceLinkOrigin({
    nodeEnv: 'production', authUrl: 'https://user:pass@good.example',
  }), OFFICIAL, 'reject origin containing credentials');
});

test('Both officer API and web signed-certificate generation use the same trusted-origin policy', () => {
  const mobile = read('lib/mobile/http.ts');
  const web = read('app/department/[department]/clearance/page.tsx');
  const route = read('app/api/mobile/orgs/[org]/clearance/route.ts');
  assert.match(mobile, /return clearanceLinkOrigin\(\)/);
  assert.match(web, /const absoluteBaseUrl = clearanceLinkOrigin\(\)/);
  assert.match(route, /publicBaseUrl\(req\) \+ clearanceVerifyPath/);
  assert.doesNotMatch(mobile, /req\.headers\.get\('(?:x-forwarded-host|host|x-forwarded-proto)'\)/);
  assert.doesNotMatch(web, /headersList\.get\('host'\)|rawHost/);
  assert.match(web, /verifyClearanceSignature\(/, 'existing independent signed certificate verification preserved');
  assert.match(web, /if \(!isOfficer && !\(sigParam && q\)\)/, 'anonymous ID searches remain denied');
});
