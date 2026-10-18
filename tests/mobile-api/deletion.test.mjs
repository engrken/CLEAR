// scripts/deletion-request.js (the admin side of /account-deletion), run against
// the local dev database with --yes.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  api, expectError, expectStatus, officerRow, prisma, resetData, runScript, schoolId, signIn, submitProof,
} from './helpers.mjs';

before(resetData);
after(() => prisma.$disconnect());

const deletion = (...args) => runScript('scripts/deletion-request.js', [...args, '--yes']);

describe('deletion-request officer', () => {
  it('deactivates the officer and revokes every mobile session', async () => {
    const a = await signIn('devdept', 'viewer');
    const b = await signIn('devdept', 'viewer');
    const run = deletion('officer', '--org', 'devdept', '--email', 'viewer@devdept.local');
    assert.equal(run.status, 0, run.out);

    const user = await officerRow('devdept', 'viewer');
    assert.equal(user.status, 'Inactive');
    assert.equal(user.otpCode, null);
    const live = await prisma.mobileSession.count({ where: { tenantUserId: user.id, revokedAt: null } });
    assert.equal(live, 0, 'all sessions should be revoked');
    for (const s of [a, b]) expectError(await api('GET', '/orgs/devdept/auth/session', { token: s.token }), 401, 'unauthorized');
    // Sign-in replies are generic now; the point is that no code is issued.
    expectStatus(await api('POST', '/orgs/devdept/auth/request-code', { json: { email: user.email } }), 200);
    assert.equal((await officerRow('devdept', 'viewer')).otpCode, null, 'no code for a deactivated officer');

    const log = await prisma.systemLog.findFirst({ where: { organizationId: user.organizationId, action: 'DEACTIVATE_OFFICER' } });
    assert.ok(log, 'the deactivation should be in the activity log');
  });

  it('--erase-contact replaces the email and username', async () => {
    const before = await officerRow('devdept', 'auditor');
    const run = deletion('officer', '--org', 'devdept', '--email', before.email, '--erase-contact');
    assert.equal(run.status, 0, run.out);
    const after = await prisma.tenantUser.findUniqueOrThrow({ where: { id: before.id } });
    assert.equal(after.status, 'Inactive');
    assert.match(after.email, /^deleted-[0-9a-z-]{8}@deleted\.invalid$/);
    assert.match(after.username, /^deleted-/);
    assert.equal(after.fullName, before.fullName, 'the name stays on the audit trail');
  });

  it("does not touch another org's officer with the same role", async () => {
    const other = await officerRow('otherdept', 'viewer');
    assert.equal(other.status, 'Active');
  });

  it('unknown officer → non-zero exit, nothing changed', async () => {
    const run = deletion('officer', '--org', 'devdept', '--email', 'nobody@devdept.local');
    assert.notEqual(run.status, 0);
    const run2 = deletion('officer', '--org', 'otherdept', '--email', 'admin@devdept.local');
    assert.notEqual(run2.status, 0, 'an officer of another org must not be found');
    assert.equal((await officerRow('devdept', 'admin')).status, 'Active');
  });
});

describe('deletion-request proofs', () => {
  it('deletes proof images of reviewed remittances only', async () => {
    const studentId = schoolId('devdept', 3);
    const reviewed = await submitProof('devdept', { studentId });
    const pending = await submitProof('devdept', { studentId });
    const { token } = await signIn('devdept', 'treasurer');
    expectStatus(await api('POST', `/orgs/devdept/remittances/${reviewed.id}/invalidate`, { token }), 200);

    const run = deletion('proofs', '--org', 'devdept', '--student', studentId);
    assert.equal(run.status, 0, run.out);

    const r1 = await prisma.onlineRemittance.findUniqueOrThrow({ where: { id: reviewed.id } });
    const r2 = await prisma.onlineRemittance.findUniqueOrThrow({ where: { id: pending.id } });
    assert.equal(r1.proofUrl, null, 'reviewed proof image should be deleted');
    assert.ok(r2.proofUrl, 'pending proof image must stay for review');
    assert.equal(r1.referenceNumber.length > 0, true, 'the remittance record stays');
  });
});

describe('deletion-request safety', () => {
  it('refuses to run without a terminal when --yes is missing', () => {
    const run = runScript('scripts/deletion-request.js', ['officer', '--org', 'devdept', '--email', 'admin@devdept.local']);
    assert.notEqual(run.status, 0);
    assert.match(run.out, /Refusing to run without a terminal/);
  });

  it('seed-demo refuses to replace a "demo" org it did not create', async () => {
    await prisma.organization.deleteMany({ where: { subdomain: 'demo' } });
    await prisma.organization.create({ data: { subdomain: 'demo', name: 'Real Org Called Demo' } });
    try {
      const run = runScript('prisma/seed-demo.js', ['--yes']);
      assert.notEqual(run.status, 0, run.out);
      assert.match(run.out, /Refusing to replace/);
      assert.ok(await prisma.organization.findUnique({ where: { subdomain: 'demo' } }), 'the org must still exist');
    } finally {
      await prisma.organization.deleteMany({ where: { subdomain: 'demo' } });
    }
  });
});
