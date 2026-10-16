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

describe('POST /orgs/:org/auth/request-code', () => {
  it('sends a code to an active officer → { sentTo }', async () => {
    const email = emailOf('devdept', 'auditor');
    await clearThrottle('devdept', email);
    const r = expectStatus(await requestCode('devdept', email), 200);
    assert.equal(typeof r.sentTo, 'string');
    const user = await officerRow('devdept', 'auditor');
    assert.ok(user.otpCode, 'a code hash should be stored');
    assert.notEqual(user.otpCode.length, 6, 'the code must be stored hashed, not in plain text');
    assert.ok(user.otpExpires > new Date());
  });

  it('a second request within 60 s → 429 cooldown', async () => {
    expectError(await requestCode('devdept', emailOf('devdept', 'auditor')), 429, 'cooldown');
  });

  it('email is not an officer → 403 not_officer', async () => {
    expectError(await requestCode('devdept', 'stranger@devdept.local'), 403, 'not_officer');
  });

  it("another org's officer → 403 not_officer", async () => {
    expectError(await requestCode('devdept', emailOf('otherdept', 'admin')), 403, 'not_officer');
  });

  it('inactive officer → 403 not_officer', async () => {
    const user = await officerRow('devdept', 'viewer');
    await prisma.tenantUser.update({ where: { id: user.id }, data: { status: 'Inactive' } });
    try {
      expectError(await requestCode('devdept', user.email), 403, 'not_officer');
    } finally {
      await prisma.tenantUser.update({ where: { id: user.id }, data: { status: 'Active' } });
    }
  });

  it('missing email → 400 invalid', async () => {
    expectError(await api('POST', '/orgs/devdept/auth/request-code', { json: {} }), 400, 'invalid');
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
  });

  it('a code is single use → second verify fails with no_code', async () => {
    expectError(await verifyCode('devdept', emailOf('devdept', 'treasurer'), KNOWN_CODE), 400, 'no_code');
  });

  it('admin gets every tab', async () => {
    const s = await signIn('devdept', 'admin');
    assertOfficer(s.officer, { org: 'devdept', role: 'admin' });
  });

  it('no code requested → 400 no_code', async () => {
    const user = await officerRow('otherdept', 'viewer');
    await prisma.tenantUser.update({ where: { id: user.id }, data: { otpCode: null, otpExpires: null } });
    expectError(await verifyCode('otherdept', user.email, KNOWN_CODE), 400, 'no_code');
  });

  it('expired code → 400 expired', async () => {
    const email = emailOf('otherdept', 'viewer');
    await setKnownCode('otherdept', email, { expires: new Date(Date.now() - 1000) });
    expectError(await verifyCode('otherdept', email, KNOWN_CODE), 400, 'expired');
  });

  it('wrong code → 400 mismatch', async () => {
    const email = emailOf('otherdept', 'auditor');
    await clearThrottle('otherdept', email);
    await setKnownCode('otherdept', email);
    expectError(await verifyCode('otherdept', email, '000000'), 400, 'mismatch');
  });

  it('5 wrong codes → 429 locked; then even the right code and a new request are locked', async () => {
    const email = emailOf('otherdept', 'treasurer');
    await clearThrottle('otherdept', email);
    await setKnownCode('otherdept', email);
    for (let i = 1; i <= 4; i++) {
      expectError(await verifyCode('otherdept', email, '111111'), 400, 'mismatch');
    }
    expectError(await verifyCode('otherdept', email, '111111'), 429, 'locked');
    await setKnownCode('otherdept', email);
    expectError(await verifyCode('otherdept', email, KNOWN_CODE), 429, 'locked');
    expectError(await requestCode('otherdept', email), 429, 'locked');
    await clearThrottle('otherdept', email);
  });

  it("another org's officer with a valid code → 403 not_officer", async () => {
    const email = emailOf('otherdept', 'admin');
    await setKnownCode('otherdept', email);
    expectError(await verifyCode('devdept', email, KNOWN_CODE), 403, 'not_officer');
  });

  it('missing code → 400', async () => {
    const res = await api('POST', '/orgs/devdept/auth/verify-code', { json: { email: emailOf('devdept', 'admin') } });
    assert.equal(res.status, 400, JSON.stringify(res.data));
    assert.ok(['invalid', 'mismatch', 'no_code'].includes(res.data?.error?.code));
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
