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

import { createWebHandoffTicket, hashWebHandoffTicket, matchesWebHandoffTicket, canRedeemWebHandoff, HANDOFF_TTL_MS } from '../lib/mobile/web-handoff-ticket.mjs';

const signingKey = 'test-only-not-production-signing-key-0000000000000000';

test('handoff secrets are random, keyed, and expire after sixty seconds', () => {
  const a = createWebHandoffTicket(signingKey, 1000);
  const b = createWebHandoffTicket(signingKey, 1000);
  assert.notEqual(a.ticket, b.ticket);
  assert.equal(a.ticket.length, 43);
  assert.equal(a.ticketHash.length, 64);
  assert.notEqual(a.ticketHash, a.ticket);
  assert.equal(a.ticketHash, hashWebHandoffTicket(a.ticket, signingKey));
  assert.equal(matchesWebHandoffTicket(a.ticket, a.ticketHash, signingKey), true);
  assert.equal(matchesWebHandoffTicket(b.ticket, a.ticketHash, signingKey), false);
  assert.equal(matchesWebHandoffTicket(a.ticket, a.ticketHash, 'different-key-000000000000000000000000000'), false);
  assert.equal(a.expiresAt.getTime(), 1000 + HANDOFF_TTL_MS);
});

test('handoff redemption denies expired, consumed, revoked and malformed records', () => {
  const record = { expiresAt: new Date(61000), consumedAt: null, revokedAt: null };
  assert.equal(canRedeemWebHandoff(record, 60999), true);
  assert.equal(canRedeemWebHandoff(record, 61000), false);
  assert.equal(canRedeemWebHandoff({ ...record, consumedAt: new Date() }, 1000), false);
  assert.equal(canRedeemWebHandoff({ ...record, revokedAt: new Date() }, 1000), false);
  assert.equal(canRedeemWebHandoff({ ...record, expiresAt: 'invalid' }, 1000), false);
});

test('malformed or short signing keys cannot mint valid tickets', () => {
  assert.throws(() => createWebHandoffTicket('short'));
  assert.throws(() => hashWebHandoffTicket('bad', signingKey));
  assert.equal(matchesWebHandoffTicket('bad', '0'.repeat(64), signingKey), false);
});

test('database redemption is consume-once under concurrent requests', () => {
  const store = source('lib/mobile/web-handoff-store.ts');
  assert.match(store, /updateMany\(/);
  assert.match(store, /consumedAt: null, revokedAt: null, expiresAt: \{ gt: now \}/);
  assert.match(store, /changed\.count !== 1/);
  assert.match(store, /\$transaction\(/);
});

test('database schema constrains ticket lifetime and principal tenant separation', () => {
  const sql = source('prisma/migrations/20261101150000_mobile_web_handoff/migration.sql');
  assert.match(sql, /UNIQUE INDEX "MobileWebHandoff_ticketHash_key"/);
  assert.match(sql, /INTERVAL '60 seconds'/);
  assert.match(sql, /"principalType" = 'global' AND "organizationId" IS NULL/);
  assert.doesNotMatch(sql, /"ticket" TEXT/);
});

test('both native roles expose safe browser switch with independent sign-in fallback', () => {
  const officer = source('mobile/src/app/(officer)/more.tsx');
  const global = source('mobile/src/app/global/index.tsx');
  const links = source('mobile/src/lib/links.ts');
  assert.match(officer, /Switch to Web Portal/);
  assert.match(officer, /switchToDepartmentWebPortal\(session\.org\.subdomain\)/);
  assert.match(global, /Switch to Web Portal/);
  assert.match(global, /switchToGlobalWebPortal\(\)/);
  assert.match(links, /return openDepartmentWebPortal\(slug\)/);
  assert.match(links, /return openGlobalAdministrationPortal\(\)/);
  assert.match(officer, /Separate web sign-in is required/);
});

test('first-party browser handoff URL validator rejects hostile destinations at runtime', async () => {
  const { validateWebHandoffUrl } = await import('../mobile/src/lib/web-handoff.ts');
  const ticket = 'A'.repeat(43);
  const valid = `https://clearsys.vercel.app/auth/mobile-handoff?ticket=${ticket}`;
  assert.equal(validateWebHandoffUrl(valid), valid);
  for (const bad of [
    `http://clearsys.vercel.app/auth/mobile-handoff?ticket=${ticket}`,
    `https://clearsys.vercel.app.evil.example/auth/mobile-handoff?ticket=${ticket}`,
    `https://clearsys.vercel.app@evil.example/auth/mobile-handoff?ticket=${ticket}`,
    `https://clearsys.vercel.app/auth/mobile-handoff?ticket=${ticket}&redirect=https://evil.example`,
    `https://clearsys.vercel.app/auth/mobile-handoff?ticket=${ticket}#secret`,
    'https://clearsys.vercel.app/auth/mobile-handoff?ticket=short',
    `https://clearsys.vercel.app/department/example?ticket=${ticket}`,
  ]) assert.throws(() => validateWebHandoffUrl(bad), bad);
});
