// Officer sign-in (request/verify code) and bearer sessions (GET/DELETE, revocation, expiry).

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  KNOWN_CODE,
  api, assertIsoDate, assertOfficer, assertOrganization, clearThrottle, emailOf, expectError,
  expectStatus, hashToken, officerRow, prisma, resetData, setKnownCode, signIn,
} from './helpers.mjs';

before(resetData);
after(() => prisma.$disconnect());

const requestCode = (org, email) => api('POST', `/orgs/${org}/auth/request-code`, { json: { email } });
const verifyCode = (org, email, code) => api('POST', `/orgs/${org}/auth/verify-code`, { json: { email, code } });

// Sign-in uses the web's lib/department-otp.ts: every request-code reply is the same
// generic 200 (no account discovery) and every verify failure is 400 invalid_code.
const GENERIC = 'If the account is registered and active, a verification code has been sent.';
const expectGenericSent = (res, email) => {
  const r = expectStatus(res, 200);
  assert.equal(r.message, GENERIC);
  assert.equal(r.sentTo, email, 'sentTo echoes the typed address (app 1.0.0 shows it)');
};
const storedCode = async (org, email) => {
  const o = await prisma.organization.findUniqueOrThrow({ where: { subdomain: org } });
  return (await prisma.tenantUser.findFirst({ where: { organizationId: o.id, email } }))?.otpCode ?? null;
};

describe('POST /orgs/:org/auth/request-code', () => {
  it('sends a code to an active officer → generic { message, sentTo }', async () => {
    const email = emailOf('devdept', 'auditor');
    await clearThrottle('devdept', email);
    expectGenericSent(await requestCode('devdept', email), email);
    const user = await officerRow('devdept', 'auditor');
    assert.ok(user.otpCode, 'a code hash should be stored');
    assert.equal(user.otpCode.length, 64, 'the code must be stored as an HMAC, not in plain text');
    assert.ok(user.otpExpires > new Date());
    assert.equal(user.otpRequestCount, 1);
  });

  it('a second request within 60 s → same reply, no new code', async () => {
    const email = emailOf('devdept', 'auditor');
    const before = await storedCode('devdept', email);
    expectGenericSent(await requestCode('devdept', email), email);
    assert.equal(await storedCode('devdept', email), before, 'the pending code must not change during the cooldown');
  });

  it('email is not an officer → same reply', async () => {
    expectGenericSent(await requestCode('devdept', 'stranger@devdept.local'), 'stranger@devdept.local');
  });

  it("another org's officer → same reply, no code stored for them", async () => {
    const email = emailOf('otherdept', 'admin');
    await clearThrottle('otherdept', email);
    expectGenericSent(await requestCode('devdept', email), email);
    assert.equal(await storedCode('otherdept', email), null);
  });

  it('inactive officer → same reply, no code stored', async () => {
    const user = await officerRow('devdept', 'viewer');
    await clearThrottle('devdept', user.email);
    await prisma.tenantUser.update({ where: { id: user.id }, data: { status: 'Inactive' } });
    try {
      expectGenericSent(await requestCode('devdept', user.email), user.email);
      assert.equal(await storedCode('devdept', user.email), null);
    } finally {
      await prisma.tenantUser.update({ where: { id: user.id }, data: { status: 'Active' } });
    }
  });

  it('missing email → 400 invalid', async () => {
    expectError(await api('POST', '/orgs/devdept/auth/request-code', { json: {} }), 400, 'invalid');
  });

  it('malformed email → 400 invalid', async () => {
    expectError(await requestCode('devdept', 'not-an-email'), 400, 'invalid');
  });

  it('malformed JSON → 400 invalid', async () => {
    expectError(await api('POST', '/orgs/devdept/auth/request-code', { json: '{not json' }), 400, 'invalid');
  });

  it('unknown org → 404 not_found', async () => {
    expectError(await requestCode('no-such-dept-xyz', emailOf('devdept', 'admin')), 404, 'not_found');
  });
});

describe('POST /orgs/:org/auth/verify-code', () => {
  it('correct code → Session { token, officer, org, expiresAt (7 days) }', async () => {
    const email = emailOf('devdept', 'treasurer');
    await clearThrottle('devdept', email);
    expectStatus(await requestCode('devdept', email), 200);
    await setKnownCode('devdept', email);

    const s = expectStatus(await verifyCode('devdept', email, KNOWN_CODE), 200);
    assert.match(s.token, /^[A-Za-z0-9_-]{20,200}$/);
    assertOfficer(s.officer, { org: 'devdept', role: 'treasurer' });
    assertOrganization(s.org);
    assert.equal(s.org.subdomain, 'devdept');
    assertIsoDate(s.expiresAt, 'expiresAt');
    const days = (Date.parse(s.expiresAt) - Date.now()) / 86400000;
    assert.ok(days > 6.9 && days <= 7.01, `session should last 7 days, got ${days.toFixed(2)}`);

    const row = await prisma.mobileSession.findUnique({ where: { tokenHash: hashToken(s.token) } });
    assert.ok(row, 'only the SHA-256 hash of the token should be stored');
    assert.equal(row.tenantUserId, s.officer.id);
    assert.equal(await prisma.mobileSession.count({ where: { tokenHash: s.token } }), 0, 'raw token must not be stored');
    assert.equal(await storedCode('devdept', email), null, 'the code is consumed');
  });

  it('a code is single use → second verify is 400 invalid_code', async () => {
    expectError(await verifyCode('devdept', emailOf('devdept', 'treasurer'), KNOWN_CODE), 400, 'invalid_code');
  });

  it('admin gets every tab', async () => {
    const s = await signIn('devdept', 'admin');
    assertOfficer(s.officer, { org: 'devdept', role: 'admin' });
  });

  it('no code requested → 400 invalid_code', async () => {
    const user = await officerRow('otherdept', 'viewer');
    await prisma.tenantUser.update({ where: { id: user.id }, data: { otpCode: null, otpExpires: null } });
    expectError(await verifyCode('otherdept', user.email, KNOWN_CODE), 400, 'invalid_code');
  });

  it('expired code → 400 invalid_code', async () => {
    const email = emailOf('otherdept', 'viewer');
    await setKnownCode('otherdept', email, { expires: new Date(Date.now() - 1000) });
    expectError(await verifyCode('otherdept', email, KNOWN_CODE), 400, 'invalid_code');
  });

  it('wrong code → 400 invalid_code', async () => {
    const email = emailOf('otherdept', 'auditor');
    await clearThrottle('otherdept', email);
    await setKnownCode('otherdept', email);
    expectError(await verifyCode('otherdept', email, '000000'), 400, 'invalid_code');
  });

  it('5 wrong codes → code cleared and the officer locked; a new request sends nothing', async () => {
    const email = emailOf('otherdept', 'treasurer');
    await clearThrottle('otherdept', email);
    await setKnownCode('otherdept', email);
    for (let i = 1; i <= 4; i++) {
      expectError(await verifyCode('otherdept', email, '111111'), 400, 'invalid_code');
    }
    const last = await verifyCode('otherdept', email, '111111');
    expectError(last, 400, 'invalid_code');
    assert.match(last.data.error.message, /too many/i);
    const user = await officerRow('otherdept', 'treasurer');
    assert.equal(user.otpCode, null, 'the code is cleared after 5 misses');
    const lock = await prisma.authThrottle.findUnique({ where: { key: `dept-otp-lock:${user.id}` } });
    assert.ok(lock?.lockedUntil && lock.lockedUntil > new Date(), 'a lock row exists');

    await setKnownCode('otherdept', email);
    expectError(await verifyCode('otherdept', email, KNOWN_CODE), 400, 'invalid_code');
    await prisma.tenantUser.update({ where: { id: user.id }, data: { otpCode: null, otpExpires: null } });
    await prisma.authThrottle.deleteMany({ where: { key: `dept-otp-send:${user.id}` } });
    expectGenericSent(await requestCode('otherdept', email), email);
    assert.equal(await storedCode('otherdept', email), null, 'no code is issued while locked');
    await clearThrottle('otherdept', email);
  });

  it("another org's officer with a valid code → 400 invalid_code", async () => {
    const email = emailOf('otherdept', 'admin');
    await setKnownCode('otherdept', email);
    expectError(await verifyCode('devdept', email, KNOWN_CODE), 400, 'invalid_code');
  });

  it('missing or malformed code → 400 invalid', async () => {
    expectError(await api('POST', '/orgs/devdept/auth/verify-code', { json: { email: emailOf('devdept', 'admin') } }), 400, 'invalid');
    expectError(await verifyCode('devdept', emailOf('devdept', 'admin'), '12ab56'), 400, 'invalid');
  });
});

describe('GET/DELETE /orgs/:org/auth/session', () => {
  it('GET returns { officer, org, expiresAt } for a valid token', async () => {
    const s = await signIn('devdept', 'auditor');
    const r = expectStatus(await api('GET', '/orgs/devdept/auth/session', { token: s.token }), 200);
    assertOfficer(r.officer, { org: 'devdept', role: 'auditor' });
    assert.equal(r.org.subdomain, 'devdept');
    assertIsoDate(r.expiresAt, 'expiresAt');
  });

  it('no token / garbage token / non-Bearer scheme → 401 unauthorized', async () => {
    expectError(await api('GET', '/orgs/devdept/auth/session'), 401, 'unauthorized');
    expectError(await api('GET', '/orgs/devdept/auth/session', { token: 'clr_' + 'A'.repeat(43) }), 401, 'unauthorized');
    expectError(
      await api('GET', '/orgs/devdept/auth/session', { headers: { Authorization: 'Basic ' + Buffer.from('a:b').toString('base64') } }),
      401,
      'unauthorized'
    );
  });

  it('DELETE → 204; the revoked token then gets 401 everywhere', async () => {
    const s = await signIn('devdept', 'viewer');
    const other = await signIn('devdept', 'viewer'); // a second device for the same officer
    const del = await api('DELETE', '/orgs/devdept/auth/session', { token: s.token });
    assert.equal(del.status, 204);

    expectError(await api('GET', '/orgs/devdept/auth/session', { token: s.token }), 401, 'unauthorized');
    expectError(await api('GET', '/orgs/devdept/dashboard', { token: s.token }), 401, 'unauthorized');
    expectError(await api('DELETE', '/orgs/devdept/auth/session', { token: s.token }), 401, 'unauthorized');

    const row = await prisma.mobileSession.findUnique({ where: { tokenHash: hashToken(s.token) } });
    assert.ok(row?.revokedAt, 'session row should be marked revoked');

    expectStatus(await api('GET', '/orgs/devdept/auth/session', { token: other.token }), 200);
  });

  it('expired session → 401 unauthorized', async () => {
    const s = await signIn('devdept', 'viewer');
    await prisma.mobileSession.update({ where: { tokenHash: hashToken(s.token) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expectError(await api('GET', '/orgs/devdept/auth/session', { token: s.token }), 401, 'unauthorized');
  });

  it('deactivated officer → 401 unauthorized on the next request', async () => {
    const s = await signIn('devdept', 'auditor');
    const user = await officerRow('devdept', 'auditor');
    await prisma.tenantUser.update({ where: { id: user.id }, data: { status: 'Inactive' } });
    try {
      expectError(await api('GET', '/orgs/devdept/auth/session', { token: s.token }), 401, 'unauthorized');
      expectError(await api('GET', '/orgs/devdept/dashboard', { token: s.token }), 401, 'unauthorized');
    } finally {
      await prisma.tenantUser.update({ where: { id: user.id }, data: { status: 'Active' } });
    }
  });

  it('deleted officer → 401 unauthorized', async () => {
    const s = await signIn('otherdept', 'viewer');
    const user = await officerRow('otherdept', 'viewer');
    await prisma.tenantUser.delete({ where: { id: user.id } }); // cascades to the session
    expectError(await api('GET', '/orgs/otherdept/auth/session', { token: s.token }), 401, 'unauthorized');
  });
});
