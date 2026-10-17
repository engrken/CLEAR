// SaaS tenancy rules merged from engrken/CLEAR: an organization's status gates
// everything, and officers get at most 10 emailed codes per 24 hours.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  api, clearThrottle, emailOf, expectError, expectStatus, officerRow, orgRow, prisma, resetData, signIn,
} from './helpers.mjs';

before(resetData);
after(async () => {
  await prisma.organization.updateMany({ where: { subdomain: 'otherdept' }, data: { status: 'Active' } });
  await prisma.$disconnect();
});

const setStatus = (subdomain, status) => prisma.organization.update({ where: { subdomain }, data: { status } });

describe('Organization status', () => {
  it('an Inactive org is hidden from GET /orgs and its public endpoints 404', async () => {
    await setStatus('otherdept', 'Inactive');
    const orgs = expectStatus(await api('GET', '/orgs'), 200);
    assert.ok(!orgs.some((o) => o.subdomain === 'otherdept'), 'inactive org must not be listed');
    assert.ok(orgs.some((o) => o.subdomain === 'devdept'));
    expectError(await api('GET', '/orgs/otherdept'), 404, 'not_found');
    expectError(await api('GET', '/orgs/otherdept/fees'), 404, 'not_found');
  });

  it('officers of an Inactive org cannot request a code', async () => {
    const email = emailOf('otherdept', 'admin');
    await clearThrottle('otherdept', email);
    expectError(await api('POST', '/orgs/otherdept/auth/request-code', { json: { email } }), 404, 'not_found');
  });

  it('an existing token stops working once the org is Archived → 403', async () => {
    await setStatus('otherdept', 'Active');
    const session = await signIn('otherdept', 'admin');
    expectStatus(await api('GET', '/orgs/otherdept/dashboard', { token: session.token }), 200);
    await setStatus('otherdept', 'Archived');
    expectError(await api('GET', '/orgs/otherdept/dashboard', { token: session.token }), 403, 'forbidden');
    await setStatus('otherdept', 'Active');
  });
});

describe('Daily code cap', () => {
  it('the 11th code request in 24 hours → 429 daily_limit', async () => {
    const email = emailOf('devdept', 'viewer');
    await clearThrottle('devdept', email);
    const user = await officerRow('devdept', 'viewer');
    await prisma.tenantUser.update({
      where: { id: user.id },
      data: { otpRequestCount: 10, otpLastRequestedAt: new Date(Date.now() - 60 * 60 * 1000) },
    });
    expectError(await api('POST', '/orgs/devdept/auth/request-code', { json: { email } }), 429, 'daily_limit');
  });

  it('the cap resets 24 hours after the window started', async () => {
    const email = emailOf('devdept', 'viewer');
    const user = await officerRow('devdept', 'viewer');
    await prisma.authThrottle.deleteMany({ where: { key: `otp:devdept:${email}` } });
    await prisma.tenantUser.update({
      where: { id: user.id },
      data: { otpRequestCount: 10, otpLastRequestedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });
    expectStatus(await api('POST', '/orgs/devdept/auth/request-code', { json: { email } }), 200);
    const after = await officerRow('devdept', 'viewer');
    assert.equal(after.otpRequestCount, 1, 'a new window starts at 1');
    assert.equal((await orgRow('devdept')).status, 'Active');
  });
});
