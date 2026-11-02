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
  assert.match(client, /\[A-Za-z0-9_-\]\{43\}/);
});

test('both issuance endpoints authenticate before minting tickets and require rollout flag', () => {
  const officer = source('app/api/mobile/orgs/[org]/auth/web-handoff/route.ts');
  const global = source('app/api/mobile/global/auth/web-handoff/route.ts');
  assert.ok(officer.includes('requireMobileOfficer(req, slug, [])'));
  assert.ok(global.includes('requireGlobalMobileAdmin(req)'));
  for (const route of [officer, global]) {
    assert.ok(route.includes('isWebHandoffEnabled()'));
    assert.ok(route.includes('issueWebHandoff('));
  }
  const issuer = source('lib/mobile/web-handoff-issue.ts');
  assert.ok(issuer.includes('MOBILE_WEB_HANDOFF_ENABLED'));
  assert.ok(issuer.includes('MOBILE_WEB_HANDOFF_SECRET'));
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

test('both native roles expose authenticated handoff with safe fallback', () => {
  const officer = source('mobile/src/app/(officer)/more.tsx');
  const global = source('mobile/src/app/global/index.tsx');
  const links = source('mobile/src/lib/links.ts');
  assert.ok(officer.includes('Switch to Web Portal'));
  assert.ok(officer.includes('api.requestOfficerWebHandoff(session)'));
  assert.ok(global.includes('Switch to Web Portal'));
  assert.ok(global.includes('api.requestGlobalWebHandoff(global)'));
  assert.ok(links.includes('return openDepartmentWebPortal(slug)'));
  assert.ok(links.includes('return openGlobalAdministrationPortal()'));
  assert.ok(officer.includes('Secure automatic sign-in is attempted'));
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
    `https://clearsys.vercel.app/auth/mobile-handoff?ticket=${'A'.repeat(44)}`,
    ` https://clearsys.vercel.app/auth/mobile-handoff?ticket=${ticket}`,
    `https://clearsys.vercel.app/auth/mobile-handoff?ticket=${ticket} `,
    `https://clearsys.vercel.app:443/auth/mobile-handoff?ticket=${ticket}`,
    `https://clearsys.vercel.app/department/example?ticket=${ticket}`,
  ]) assert.throws(() => validateWebHandoffUrl(bad), bad);
});

test('NextAuth and browser page exchange ticket without exposing mobile bearer tokens', () => {
  const auth = source('auth.ts');
  const page = source('app/auth/mobile-handoff/page.tsx');
  const redemption = source('lib/mobile/web-handoff-redeem.ts');
  assert.ok(auth.includes("id: 'mobile-handoff'"));
  assert.ok(auth.includes('redeemWebHandoff(ticket)'));
  assert.ok(page.includes("signIn('mobile-handoff'"));
  assert.ok(page.includes('history.replaceState'));
  assert.ok(redemption.includes('consumeWebHandoffTicket'));
  assert.ok(redemption.includes('verifyGlobalAdminSession'));
  assert.ok(redemption.includes('maintenanceForTenant'));
});

test('new ticket issuance revokes previously unconsumed tickets for the same mobile session', () => {
  const issuer = source('lib/mobile/web-handoff-issue.ts');
  assert.ok(issuer.includes('mobileWebHandoff.updateMany'));
  assert.ok(issuer.includes('mobileSessionId: input.mobileSessionId'));
  assert.ok(issuer.includes('consumedAt: null, revokedAt: null'));
});

test('handoff browser response denies referrer leakage and indexing', () => {
  const config = source('next.config.ts');
  assert.ok(config.includes("source: '/auth/mobile-handoff'"));
  assert.ok(config.includes("{ key: 'Referrer-Policy', value: 'no-referrer' }"));
  assert.ok(config.includes("{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }"));
});


test('module-specific browser handoffs stay tenant-scoped and server allowlisted', () => {
  const issuer = source('lib/mobile/web-handoff-issue.ts');
  const officer = source('app/api/mobile/orgs/[org]/auth/web-handoff/route.ts');
  const redeem = source('lib/mobile/web-handoff-redeem.ts');
  const web = source('app/auth/mobile-handoff/page.tsx');
  const auth = source('auth.ts');
  const mobile = source('mobile/src/lib/links.ts');
  assert.match(issuer, /isAllowedOfficerHandoffDestination/);
  assert.match(officer, /OFFICER_WEB_PATHS.has\(webPath\)/);
  assert.match(officer, /readJson/);
  assert.match(redeem, /isAllowedOfficerHandoffDestination\(record.destination, user.organization.subdomain\)/);
  assert.match(auth, /token.handoffDestination/);
  assert.match(web, /ALLOWED_WEB_MODULE_PATHS.has\(path.slice\(base.length\)\)/);
  assert.match(mobile, /requestOfficerModuleWebHandoff/);
  assert.match(mobile, /openVerifiedWebHandoff\(url\)/);
  assert.match(mobile, /openWebPage\(fallback\)/);
});
