// Real mobile payment HTTP acceptance. Must never run against Production.
// CI launches a second localhost server with the production-main allowlist
// simulated while DATABASE_URL points only to disposable Postgres.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { moneyCentavos } from '../lib/money-precision.ts';

const expectedDb = 'postgresql://clear_ci:clear_ci@127.0.0.1:5432/clear_ci?schema=public';
if (process.env.CI !== 'true' || process.env.CLEAR_CI_FINANCE_TEST_ENABLED !== '1' ||
    process.env.DATABASE_URL !== expectedDb ||
    process.env.AUTH_URL !== 'http://127.0.0.1:3100') {
  throw new Error('REFUSING mobile payment test outside disposable CI PostgreSQL.');
}
const prisma = new PrismaClient();
const host = 'http://127.0.0.1:3102';
const academicYear = 'A.Y. CI Mobile 2026 - 2027';
const term = '1st Sem';
const newToken = () => 'clr_' + randomBytes(32).toString('base64url');

async function createOfficer(org, allowedTabs, role = 'Officer') {
  const uuid = randomUUID();
  const officer = await prisma.tenantUser.create({ data: {
    organizationId: org.id, userId: 'CI-PAY-' + uuid,
    fullName: 'CI Synthetic Mobile Officer', username: 'ci_mobile_' + uuid,
    email: 'ci-mobile-' + uuid + '@example.invalid',
    role, status: 'Active', allowedTabs: JSON.stringify(allowedTabs),
  } });
  const token = newToken();
  const session = await prisma.mobileSession.create({ data: {
    id: randomUUID(), tokenHash: createHash('sha256').update(token).digest('hex'),
    tenantUserId: officer.id, organizationId: org.id,
    expiresAt: new Date(Date.now() + 10 * 60_000),
  } });
  return { token, officer, session };
}

async function payment(slug, token, payload, key = randomUUID()) {
  const response = await fetch(host + '/api/mobile/orgs/' + slug + '/payments', {
    method: 'POST', headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(45_000),
  });
  return { status: response.status, body: await response.json() };
}

test('Android cashier: auth, tenant, cents, replay, packages and financial ledger are atomic', {
  timeout: 180_000,
}, async () => {
  const suffix = randomUUID().slice(0, 8);
  const org = await prisma.organization.create({ data: {
    subdomain: 'ci-pay-a-' + suffix, name: 'CI Mobile Cashier A',
    type: 'Department', status: 'Active', activeAy: academicYear, activeTerm: term,
  } });
  const other = await prisma.organization.create({ data: {
    subdomain: 'ci-pay-b-' + suffix, name: 'CI Mobile Cashier B',
    type: 'Department', status: 'Active', activeAy: academicYear, activeTerm: term,
  } });
  try {
    const authorized = await createOfficer(org, ['tab-payment'], 'Admin');
    const denied = await createOfficer(org, ['tab-students'], 'Officer');
    const foreign = await createOfficer(other, ['tab-payment'], 'Admin');
    const revoked = await createOfficer(org, ['tab-payment'], 'Admin');
    await prisma.mobileSession.update({ where: { id: revoked.session.id }, data: { revokedAt: new Date() } });
    const student = await prisma.student.create({ data: {
      organizationId: org.id, studentId: 'CI-PAY-STUDENT-' + suffix,
      fullName: 'CI Synthetic Payer', yearLevel: '1',
    } });
    const foreignStudent = await prisma.student.create({ data: {
      organizationId: other.id, studentId: 'CI-FOREIGN-STUDENT-' + suffix,
      fullName: 'CI Other Payer', yearLevel: '1',
    } });
    await prisma.academicPeriodConfig.create({ data: {
      organizationId: org.id, academicYear, mode: 'Semester', includeSummer: true,
    } });
    for (const fundName of ['General Fund', 'Activities Fund']) {
      await prisma.fund.create({ data: {
        organizationId: org.id, academicYear, term, fundName, initialAllocation: 0, currentBalance: 0,
      } });
    }
    const fee = await prisma.collectionSetup.create({ data: {
      organizationId: org.id, academicYear, term, category: 'Membership',
      name: 'Membership Fee', amount: 150, targetFund: 'General Fund', isPackage: false,
    } });
    const foreignFee = await prisma.collectionSetup.create({ data: {
      organizationId: other.id, academicYear, term, category: 'Membership',
      name: 'Foreign Fee', amount: 999, targetFund: 'General Fund', isPackage: false,
    } });
    await prisma.collectible.create({ data: {
      organizationId: org.id, academicYear, term, category: 'Membership',
      headcount: 1, balanceDue: 150,
      status: 'Unpaid|SID:' + student.studentId + '|ITEM:Membership%20Fee',
    } });
    const draft = { studentId: student.id, feeId: fee.id, amountCentavos: 5005 };
    assert.equal((await payment(org.subdomain, null, draft)).status, 401);
    assert.equal((await payment(org.subdomain, denied.token, draft)).status, 403);
    assert.equal((await payment(org.subdomain, foreign.token, draft)).status, 403);
    assert.equal((await payment(org.subdomain, revoked.token, draft)).status, 401);
    assert.equal((await payment(org.subdomain, authorized.token, { ...draft, studentId: foreignStudent.id })).status, 422);
    assert.equal((await payment(org.subdomain, authorized.token, { ...draft, feeId: foreignFee.id })).status, 400);
    for (const bad of [0, -1, 10.01, '5005', 100_000_001]) {
      assert.equal((await payment(org.subdomain, authorized.token, { ...draft, amountCentavos: bad })).status, 400,
        'Rejected invalid financial amount ' + String(bad));
    }
    const idempotencyKey = randomUUID();
    const simultaneous = await Promise.all(Array.from({ length: 4 }, () =>
      payment(org.subdomain, authorized.token, draft, idempotencyKey)));
    const accepted = simultaneous.filter(r => r.status === 200);
    assert.ok(accepted.length > 0, 'At least one authorized payment must commit: ' + JSON.stringify(simultaneous));
    const orNumber = accepted[0].body.orNumber;
    assert.match(orNumber, /^OR-\d{8}-\d{6}-\d+$/);
    assert.ok(accepted.every(r => r.body.orNumber === orNumber));
    assert.equal(accepted[0].body.paymentEntries, 1);
    assert.equal(accepted[0].body.balanceDue, 99.95);
    const replay = await payment(org.subdomain, authorized.token, draft, idempotencyKey);
    assert.equal(replay.status, 200, JSON.stringify(replay.body));
    assert.equal(replay.body.orNumber, orNumber);
    const [recorded, requests, deliveries] = await Promise.all([
      prisma.collection.findMany({ where: { organizationId: org.id, orNumber } }),
      prisma.paymentRequest.findMany({ where: { organizationId: org.id, requestId: idempotencyKey } }),
      prisma.digitalReceiptDelivery.findMany({ where: { organizationId: org.id, referenceNo: orNumber } }),
    ]);
    assert.equal(recorded.length, 1, 'One collection for an exact duplicate mobile request');
    assert.equal(moneyCentavos(recorded[0].amountPaid), 5005);
    assert.equal(moneyCentavos(recorded[0].balanceDue), 9995);
    assert.equal(requests.length, 1);
    assert.ok(deliveries.length <= 1, 'No duplicate receipt delivery jobs');
    const changed = await payment(org.subdomain, authorized.token,
      { ...draft, amountCentavos: 5006 }, idempotencyKey);
    assert.equal(changed.status, 409, JSON.stringify(changed.body));
    assert.equal(changed.body.error.code, 'idempotency_conflict');
    const balance = await prisma.collectible.findFirstOrThrow({ where: {
      organizationId: org.id, category: 'Membership',
    } });
    assert.equal(moneyCentavos(balance.balanceDue), 9995);

    const tooMuch = await payment(org.subdomain, authorized.token,
      { ...draft, amountCentavos: 9996 });
    assert.equal(tooMuch.status, 422, JSON.stringify(tooMuch.body));
    assert.equal(tooMuch.body.error.code, 'overpayment');
    const finish = await payment(org.subdomain, authorized.token,
      { ...draft, amountCentavos: 9995 });
    assert.equal(finish.status, 200, JSON.stringify(finish.body));
    assert.equal(finish.body.balanceDue, 0);
    const closedAssessment = await prisma.collectible.findFirstOrThrow({ where: { id: balance.id } });
    assert.equal(moneyCentavos(closedAssessment.balanceDue), 0);

    const firstPackage = await prisma.collectionSetup.create({ data: {
      organizationId: org.id, academicYear, term, category: 'Departmental Fee',
      name: 'Activities', amount: 200, targetFund: 'General Fund', isPackage: true,
    } });
    await prisma.collectionSetup.create({ data: {
      organizationId: org.id, academicYear, term, category: 'Departmental Fee',
      name: 'School Program', amount: 300, targetFund: 'Activities Fund', isPackage: true,
    } });
    const pkg = await payment(org.subdomain, authorized.token, {
      studentId: student.id, feeId: 'package:' + firstPackage.id, amountCentavos: 32500,
    });
    assert.equal(pkg.status, 200, JSON.stringify(pkg.body));
    assert.equal(pkg.body.paymentEntries, 2);
    const split = await prisma.collection.findMany({ where: {
      organizationId: org.id, orNumber: { startsWith: pkg.body.orNumber },
    }, orderBy: { orNumber: 'asc' } });
    assert.equal(split.length, 2);
    assert.deepEqual(split.map(row => moneyCentavos(row.amountPaid)), [20000, 12500]);
    assert.deepEqual(split.map(row => row.fundAllocation), ['General Fund', 'Activities Fund']);
    assert.equal(split.reduce((sum, row) => sum + moneyCentavos(row.amountPaid), 0), 32500);
    assert.equal(pkg.body.balanceDue, 175);
    assert.equal(await prisma.collection.count({ where: {
      organizationId: other.id,
    } }), 0, 'All authenticated payment writes must stay within the caller tenant');
  } finally {
    // Database itself is destroyed after CI; never attempt Production cleanup.
    await prisma.$disconnect();
  }
});
