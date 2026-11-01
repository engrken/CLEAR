import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('mobile handoff URL only accepts first-party HTTPS ticket endpoint', () => {
  const client = source('mobile/src/lib/web-handoff.ts');
  assert.match(client, /https:\/\/clearsys\.vercel\.app/);
  assert.match(client, /url\.origin !== WEB_ORIGIN/);
  assert.match(client, /url\.pathname !== '\/auth\/mobile-handoff'/);
  assert.match(client, /url\.searchParams\.size !== 1/);
  assert.match(client, /\[A-Za-z0-9_-\]\{43,128\}/);
});

test('officer and global issuance endpoints fail closed after authentication', () => {
  const officer = source('app/api/mobile/orgs/[org]/auth/web-handoff/route.ts');
  const global = source('app/api/mobile/global/auth/web-handoff/route.ts');
  assert.match(officer, /requireMobileOfficer\(req, org, \[\]\)/);
  assert.match(global, /requireGlobalMobileAdmin\(req\)/);
  for (const route of [officer, global]) {
    assert.match(route, /throw new ApiFailure\(503, 'unavailable'/);
    assert.doesNotMatch(route, /randomBytes|create\(/);
  }
});

test('browser handoff requests are POST-only and separate by principal', () => {
  const api = source('mobile/src/api/http.ts');
  assert.match(api, /requestOfficerWebHandoff: \(s\) => request/);
  assert.match(api, /requestGlobalWebHandoff: \(session\) => request/);
  assert.match(api, /auth\/web-handoff.*method: 'POST'/);
});
