// Tenant isolation (a token only works in its own org, and ids from another org
// are never reachable) and role/tab checks on officer endpoints.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLE_TABS,
  api, expectAnyError, expectError, expectStatus, feeRow, officerRow, prisma, resetData,
  schoolId, signIn, studentRow, submitProof, uniq,
} from './helpers.mjs';

const tokens = {};
let otherRemittance; // OnlineRemittance in otherdept
let devRemittance; // OnlineRemittance in devdept

before(async () => {
  await resetData();
  for (const role of ['admin', 'treasurer', 'auditor', 'viewer']) tokens[role] = (await signIn('devdept', role)).token;
  tokens.otherAdmin = (await signIn('otherdept', 'admin')).token;
  otherRemittance = await submitProof('otherdept', { studentId: schoolId('otherdept', 1) });
  devRemittance = await submitProof('devdept', { studentId: schoolId('devdept', 1) });
});
after(() => prisma.$disconnect());

const collectionCount = async () => prisma.collection.count();

describe('a devdept token on otherdept paths → 403 forbidden', () => {
  const cases = () => [
    ['GET', '/orgs/otherdept/auth/session'],
    ['DELETE', '/orgs/otherdept/auth/session'],
    ['GET', '/orgs/otherdept/dashboard'],
    ['GET', '/orgs/otherdept/ledger'],
    ['GET', '/orgs/otherdept/students'],
    ['GET', `/orgs/otherdept/remittances/${otherRemittance.id}`],
  ];

  it('read endpoints', async () => {
    for (const [method, path] of cases()) {
      expectError(await api(method, path, { token: tokens.admin }), 403, 'forbidden');
    }
  });

  it('the token still works in its own org afterwards (DELETE on the wrong org did not revoke it)', async () => {
    expectStatus(await api('GET', '/orgs/devdept/auth/session', { token: tokens.admin }), 200);
  });

  it('POST payments with otherdept ids → 403, nothing recorded', async () => {
    const before = await collectionCount();
    const student = await studentRow('otherdept', 1);
    const fee = await feeRow('otherdept', 'Membership Fee');
    const res = await api('POST', '/orgs/otherdept/payments', {
      token: tokens.admin,
      json: { studentId: student.id, feeId: fee.id, amountCentavos: 15000, orNumber: uniq('OR') },
    });
    expectError(res, 403, 'forbidden');
    assert.equal(await collectionCount(), before);
  });

  it('verify / invalidate an otherdept remittance → 403, status unchanged', async () => {
    expectError(
      await api('POST', `/orgs/otherdept/remittances/${otherRemittance.id}/verify`, { token: tokens.admin, json: { orNumber: uniq('OR') } }),
      403,
      'forbidden'
    );
    expectError(await api('POST', `/orgs/otherdept/remittances/${otherRemittance.id}/invalidate`, { token: tokens.admin }), 403, 'forbidden');
    const row = await prisma.onlineRemittance.findUnique({ where: { id: otherRemittance.id } });
    assert.equal(row.status, 'Pending Verification');
  });

  it('the reverse direction is blocked too (otherdept token on devdept)', async () => {
    expectError(await api('GET', '/orgs/devdept/dashboard', { token: tokens.otherAdmin }), 403, 'forbidden');
    expectError(await api('GET', `/orgs/devdept/remittances/${devRemittance.id}`, { token: tokens.otherAdmin }), 403, 'forbidden');
  });
});

describe("another org's ids through your own org's path", () => {
  it('GET an otherdept remittance id under /orgs/devdept → 404 not_found', async () => {
    expectError(await api('GET', `/orgs/devdept/remittances/${otherRemittance.id}`, { token: tokens.admin }), 404, 'not_found');
  });

  it('verify / invalidate an otherdept remittance id under /orgs/devdept → 404, status unchanged', async () => {
    expectError(
      await api('POST', `/orgs/devdept/remittances/${otherRemittance.id}/verify`, { token: tokens.admin, json: { orNumber: uniq('OR') } }),
      404,
      'not_found'
    );
    expectError(await api('POST', `/orgs/devdept/remittances/${otherRemittance.id}/invalidate`, { token: tokens.admin }), 404, 'not_found');
    const row = await prisma.onlineRemittance.findUnique({ where: { id: otherRemittance.id } });
    assert.equal(row.status, 'Pending Verification');
  });

  it('payment for an otherdept student (database id or school ID) → 422 invalid_student', async () => {
    const before = await collectionCount();
    const fee = await feeRow('devdept', 'Membership Fee');
    const student = await studentRow('otherdept', 2);
    for (const studentId of [student.id, student.studentId]) {
      const res = await api('POST', '/orgs/devdept/payments', {
        token: tokens.admin,
        json: { studentId, feeId: fee.id, amountCentavos: 15000, orNumber: uniq('OR') },
      });
      expectError(res, 422, 'invalid_student');
    }
    assert.equal(await collectionCount(), before);
  });

  it('payment with an otherdept fee id → 400/404, nothing recorded', async () => {
    const before = await collectionCount();
    const fee = await feeRow('otherdept', 'Membership Fee');
    const student = await studentRow('devdept', 2);
    const res = await api('POST', '/orgs/devdept/payments', {
      token: tokens.admin,
      json: { studentId: student.id, feeId: fee.id, amountCentavos: 15000, orNumber: uniq('OR') },
    });
    expectAnyError(res, [400, 404]);
    assert.equal(await collectionCount(), before);
  });

  it('students list only has devdept students', async () => {
    const students = expectStatus(await api('GET', '/orgs/devdept/students', { token: tokens.admin }), 200);
    assert.equal(students.length, 5);
    for (const s of students) assert.match(s.studentId, /^DEV-/);
    const all = expectStatus(await api('GET', `/orgs/devdept/students?q=${encodeURIComponent('OTH-2026')}`, { token: tokens.admin }), 200);
    assert.equal(all.length, 0);
  });

  it("ledger never shows the other org's entries", async () => {
    const ledger = expectStatus(await api('GET', '/orgs/devdept/ledger', { token: tokens.admin }), 200);
    const ids = ledger.map((e) => e.id);
    assert.ok(!ids.includes(otherRemittance.id), 'otherdept remittance leaked into devdept ledger');
    assert.ok(ids.includes(devRemittance.id), 'devdept remittance missing from its own ledger');
  });
});

describe('role / tab checks', () => {
  const payment = async (token, n = 3) => {
    const student = await studentRow('devdept', n);
    const fee = await feeRow('devdept', 'Membership Fee');
    return api('POST', '/orgs/devdept/payments', {
      token,
      json: { studentId: student.id, feeId: fee.id, amountCentavos: 5000, orNumber: uniq('OR') },
    });
  };

  it('viewer → payments 403 forbidden, nothing recorded', async () => {
    const before = await collectionCount();
    expectError(await payment(tokens.viewer), 403, 'forbidden');
    assert.equal(await collectionCount(), before);
  });

  it('role check happens before input validation (viewer, empty body → 403)', async () => {
    expectError(await api('POST', '/orgs/devdept/payments', { token: tokens.viewer, json: {} }), 403, 'forbidden');
  });

  it('auditor → payments 403 forbidden', async () => {
    expectError(await payment(tokens.auditor), 403, 'forbidden');
  });

  it('treasurer → payments 201', async () => {
    expectStatus(await payment(tokens.treasurer, 3), 201);
  });

  it('admin → payments 201', async () => {
    expectStatus(await payment(tokens.admin, 4), 201);
  });

  it('viewer / auditor → students 403 (no tab-students or tab-payment)', async () => {
    expectError(await api('GET', '/orgs/devdept/students', { token: tokens.viewer }), 403, 'forbidden');
    expectError(await api('GET', '/orgs/devdept/students', { token: tokens.auditor }), 403, 'forbidden');
  });

  it('treasurer → students 200 (via tab-payment)', async () => {
    expectStatus(await api('GET', '/orgs/devdept/students', { token: tokens.treasurer }), 200);
  });

  it('viewer / auditor → remittance detail, verify, invalidate 403', async () => {
    for (const token of [tokens.viewer, tokens.auditor]) {
      expectError(await api('GET', `/orgs/devdept/remittances/${devRemittance.id}`, { token }), 403, 'forbidden');
      expectError(
        await api('POST', `/orgs/devdept/remittances/${devRemittance.id}/verify`, { token, json: { orNumber: uniq('OR') } }),
        403,
        'forbidden'
      );
      expectError(await api('POST', `/orgs/devdept/remittances/${devRemittance.id}/invalidate`, { token }), 403, 'forbidden');
    }
    const row = await prisma.onlineRemittance.findUnique({ where: { id: devRemittance.id } });
    assert.equal(row.status, 'Pending Verification');
  });

  it('every role can read dashboard and ledger (tab-overview)', async () => {
    for (const role of ['admin', 'treasurer', 'auditor', 'viewer']) {
      expectStatus(await api('GET', '/orgs/devdept/dashboard', { token: tokens[role] }), 200);
      expectStatus(await api('GET', '/orgs/devdept/ledger', { token: tokens[role] }), 200);
    }
  });

  it('officer without tab-overview → dashboard/ledger 403', async () => {
    const user = await officerRow('devdept', 'viewer');
    await prisma.tenantUser.update({ where: { id: user.id }, data: { allowedTabs: JSON.stringify(['tab-clearance']) } });
    try {
      expectError(await api('GET', '/orgs/devdept/dashboard', { token: tokens.viewer }), 403, 'forbidden');
      expectError(await api('GET', '/orgs/devdept/ledger', { token: tokens.viewer }), 403, 'forbidden');
    } finally {
      await prisma.tenantUser.update({ where: { id: user.id }, data: { allowedTabs: JSON.stringify(ROLE_TABS.viewer) } });
    }
  });

  it('demoting a treasurer takes effect on the next request (no re-login)', async () => {
    const user = await officerRow('devdept', 'treasurer');
    await prisma.tenantUser.update({ where: { id: user.id }, data: { role: 'viewer', allowedTabs: JSON.stringify(ROLE_TABS.viewer) } });
    try {
      expectError(await payment(tokens.treasurer, 5), 403, 'forbidden');
      const s = expectStatus(await api('GET', '/orgs/devdept/auth/session', { token: tokens.treasurer }), 200);
      assert.equal(s.officer.role, 'viewer');
    } finally {
      await prisma.tenantUser.update({
        where: { id: user.id },
        data: { role: 'treasurer', allowedTabs: JSON.stringify(ROLE_TABS.treasurer) },
      });
    }
    expectStatus(await payment(tokens.treasurer, 5), 201);
  });
});
