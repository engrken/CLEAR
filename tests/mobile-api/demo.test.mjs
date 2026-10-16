// Play reviewer demo sign-in (lib/demo-reviewer.ts): the fixed code signs in the
// demo officer of the demo org, on the mobile API and the web, through the normal
// request/verify path, and never works for any other email or org.
// Needs DEMO_REVIEWER_EMAIL and DEMO_REVIEWER_CODE in .env (skipped otherwise).

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  API_URL, DEMO_CODE, DEMO_EMAIL, DEMO_ON, DEMO_ORG,
  api, assertOrganization, emailOf, expectError, expectStatus, hashToken, orgRow, prisma,
  resetData, resetDemo,
} from './helpers.mjs';

const WEB_URL = API_URL.replace(/\/api\/mobile$/, '');
const skip = DEMO_ON ? false : 'set DEMO_REVIEWER_EMAIL and DEMO_REVIEWER_CODE in .env to run';

const requestCode = (org, email) => api('POST', `/orgs/${org}/auth/request-code`, { json: { email } });
const verifyCode = (org, email, code) => api('POST', `/orgs/${org}/auth/verify-code`, { json: { email, code } });
const throttleKey = (org, email) => `otp:${org}:${email.toLowerCase()}`;
const clearKey = (org, email) => prisma.authThrottle.deleteMany({ where: { key: throttleKey(org, email) } });

async function demoOfficer() {
  const org = await orgRow(DEMO_ORG);
  return prisma.tenantUser.findFirstOrThrow({ where: { organizationId: org.id, email: DEMO_EMAIL } });
}

/** A temporary active officer, removed by the returned function. */
async function tempOfficer(orgSlug, email) {
  const org = await orgRow(orgSlug);
  const tag = Math.random().toString(36).slice(2, 8);
  const user = await prisma.tenantUser.create({
    data: {
      organizationId: org.id,
      userId: `USR-TMP-${tag}`,
      fullName: `Temp ${tag}`,
      username: `tmp-${tag}`,
      email,
      role: 'treasurer',
      allowedTabs: '[]',
      status: 'Active',
    },
  });
  await clearKey(orgSlug, email);
  return async () => {
    await prisma.tenantUser.delete({ where: { id: user.id } });
    await clearKey(orgSlug, email);
  };
}

/** Auth.js credentials sign-in on the web; true when a session cookie is issued. */
async function webSignIn(department, email, code) {
  const csrf = await fetch(`${WEB_URL}/api/auth/csrf`);
  const { csrfToken } = await csrf.json();
  const cookie = csrf.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const res = await fetch(`${WEB_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie, 'X-Auth-Return-Redirect': '1' },
    body: new URLSearchParams({ email, code, department, csrfToken }),
  });
  return res.headers.getSetCookie().some((c) => /^(__Secure-)?authjs\.session-token=[^;]+/.test(c));
}

before(async () => {
  await resetData();
  if (DEMO_ON) await resetDemo();
});
after(() => prisma.$disconnect());

describe('demo reviewer sign-in', { skip }, () => {
  it('GET /orgs lists the demo org while the flag is on', async () => {
    const orgs = expectStatus(await api('GET', '/orgs'), 200);
    const demo = orgs.find((o) => o.subdomain === DEMO_ORG);
    assert.ok(demo, 'demo org missing from /orgs');
    assertOrganization(demo);
  });

  it('request-code stores the fixed code (hashed) and verify-code signs in the demo officer', async () => {
    await clearKey(DEMO_ORG, DEMO_EMAIL);
    const r = expectStatus(await requestCode(DEMO_ORG, DEMO_EMAIL), 200);
    assert.equal(r.sentTo, DEMO_EMAIL);
    const user = await demoOfficer();
    assert.equal(user.otpCode, hashToken(DEMO_CODE), 'the fixed code should be stored as its hash');
    assert.ok(user.otpExpires > new Date());

    const s = expectStatus(await verifyCode(DEMO_ORG, DEMO_EMAIL, DEMO_CODE), 200);
    assert.equal(s.org.subdomain, DEMO_ORG);
    assert.equal(s.officer.email, DEMO_EMAIL);
    assert.equal(s.officer.role, 'treasurer');

    expectStatus(await api('GET', `/orgs/${DEMO_ORG}/dashboard`, { token: s.token }), 200);
    expectError(await api('GET', '/orgs/devdept/dashboard', { token: s.token }), 403, 'forbidden');
  });

  it('the fixed code is single use', async () => {
    expectError(await verifyCode(DEMO_ORG, DEMO_EMAIL, DEMO_CODE), 400, 'no_code');
  });

  it('the fixed code does nothing without a request-code first', async () => {
    const user = await demoOfficer();
    await prisma.tenantUser.update({ where: { id: user.id }, data: { otpCode: null, otpExpires: null } });
    expectError(await verifyCode(DEMO_ORG, DEMO_EMAIL, DEMO_CODE), 400, 'no_code');
  });

  it('the demo email matches case-insensitively', async () => {
    await clearKey(DEMO_ORG, DEMO_EMAIL);
    const shouty = DEMO_EMAIL.toUpperCase();
    expectStatus(await requestCode(DEMO_ORG, shouty), 200);
    expectStatus(await verifyCode(DEMO_ORG, shouty, DEMO_CODE), 200);
  });

  it('expires after 5 minutes like any code', async () => {
    await clearKey(DEMO_ORG, DEMO_EMAIL);
    expectStatus(await requestCode(DEMO_ORG, DEMO_EMAIL), 200);
    const user = await demoOfficer();
    await prisma.tenantUser.update({ where: { id: user.id }, data: { otpExpires: new Date(Date.now() - 1000) } });
    expectError(await verifyCode(DEMO_ORG, DEMO_EMAIL, DEMO_CODE), 400, 'expired');
  });

  it('wrong codes still lock the demo officer out, and the fixed code is refused while locked', async () => {
    await clearKey(DEMO_ORG, DEMO_EMAIL);
    expectStatus(await requestCode(DEMO_ORG, DEMO_EMAIL), 200);
    const wrong = DEMO_CODE === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) expectError(await verifyCode(DEMO_ORG, DEMO_EMAIL, wrong), 400, 'mismatch');
    expectError(await verifyCode(DEMO_ORG, DEMO_EMAIL, wrong), 429, 'locked');
    expectError(await verifyCode(DEMO_ORG, DEMO_EMAIL, DEMO_CODE), 429, 'locked');
    expectError(await requestCode(DEMO_ORG, DEMO_EMAIL), 429, 'locked');
    await clearKey(DEMO_ORG, DEMO_EMAIL);
  });

  it('web sign-in (Auth.js) accepts the fixed code for the demo officer', async () => {
    await clearKey(DEMO_ORG, DEMO_EMAIL);
    expectStatus(await requestCode(DEMO_ORG, DEMO_EMAIL), 200);
    assert.equal(await webSignIn(DEMO_ORG, DEMO_EMAIL, DEMO_CODE), true, 'expected a web session cookie');
  });
});

describe('the fixed code fails for every other email or org', { skip }, () => {
  it('another officer of the demo org', async () => {
    const email = 'second-officer@demo.clear.invalid';
    const remove = await tempOfficer(DEMO_ORG, email);
    try {
      expectStatus(await requestCode(DEMO_ORG, email), 200);
      const org = await orgRow(DEMO_ORG);
      const row = await prisma.tenantUser.findFirstOrThrow({ where: { organizationId: org.id, email } });
      assert.notEqual(row.otpCode, hashToken(DEMO_CODE), 'another officer must get a random code');
      expectError(await verifyCode(DEMO_ORG, email, DEMO_CODE), 400, 'mismatch');
      assert.equal(await webSignIn(DEMO_ORG, email, DEMO_CODE), false, 'web must refuse it too');
    } finally {
      await remove();
    }
  });

  it('the demo email as an officer of a real org', async () => {
    const remove = await tempOfficer('devdept', DEMO_EMAIL);
    try {
      expectStatus(await requestCode('devdept', DEMO_EMAIL), 200);
      const org = await orgRow('devdept');
      const row = await prisma.tenantUser.findFirstOrThrow({ where: { organizationId: org.id, email: DEMO_EMAIL } });
      assert.notEqual(row.otpCode, hashToken(DEMO_CODE), 'the demo email in another org must get a random code');
      expectError(await verifyCode('devdept', DEMO_EMAIL, DEMO_CODE), 400, 'mismatch');
      assert.equal(await webSignIn('devdept', DEMO_EMAIL, DEMO_CODE), false, 'web must refuse it too');
    } finally {
      await remove();
    }
  });

  it('a regular officer of a real org', async () => {
    const email = emailOf('devdept', 'auditor');
    await clearKey('devdept', email);
    expectStatus(await requestCode('devdept', email), 200);
    expectError(await verifyCode('devdept', email, DEMO_CODE), 400, 'mismatch');
    await clearKey('devdept', email);
  });

  it('the demo email in a real org where it is not an officer', async () => {
    expectError(await requestCode('otherdept', DEMO_EMAIL), 403, 'not_officer');
    expectError(await verifyCode('otherdept', DEMO_EMAIL, DEMO_CODE), 403, 'not_officer');
  });
});
