// Fail-closed runtime gate regression. This test exercises a real Next.js API
// with synthetic credentials against ONLY the disposable CircleCI database.
// Positive payment POST acceptance remains a separate, mandatory release gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const expected = 'postgresql://clear_ci:clear_ci@127.0.0.1:5432/clear_ci?schema=public';
if (process.env.CI !== 'true' || process.env.CLEAR_CI_FINANCE_TEST_ENABLED !== '1' ||
  process.env.DATABASE_URL !== expected || process.env.AUTH_URL !== 'http://127.0.0.1:3100') {
  throw new Error('REFUSING mobile deny-by-default regression outside disposable CI database.');
}

test('Android posting stays denied with real active officer credentials and changes no financial records', {
  timeout: 60_000,
}, async () => {
  const prisma = new PrismaClient();
  try {
    const org = await prisma.organization.findUniqueOrThrow({ where: { subdomain: 'ci-financial' } });
    const student = await prisma.student.findFirstOrThrow({ where: { organizationId: org.id } });
    const fee = await prisma.collectionSetup.findFirstOrThrow({ where: { organizationId: org.id } });
    const officer = await prisma.tenantUser.findFirstOrThrow({
      where: { organizationId: org.id, email: 'ci-officer@example.invalid' },
    });
    const token = 'clr_' + randomBytes(32).toString('base64url');
    const session = await prisma.mobileSession.create({ data: {
      id: randomUUID(), tokenHash: createHash('sha256').update(token).digest('hex'),
      tenantUserId: officer.id, organizationId: org.id, expiresAt: new Date(Date.now() + 60_000),
    } });
    const before = await Promise.all([
      prisma.collection.count({ where: { organizationId: org.id } }),
      prisma.paymentRequest.count({ where: { organizationId: org.id } }),
      prisma.digitalReceiptDelivery.count({ where: { organizationId: org.id } }),
    ]);
    const response = await fetch('http://127.0.0.1:3100/api/mobile/orgs/ci-financial/payments', {
      method: 'POST', headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token, 'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({ studentId: student.id, feeId: fee.id, amountCentavos: 100 }),
      signal: AbortSignal.timeout(15_000),
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, 'read_only');
    const after = await Promise.all([
      prisma.collection.count({ where: { organizationId: org.id } }),
      prisma.paymentRequest.count({ where: { organizationId: org.id } }),
      prisma.digitalReceiptDelivery.count({ where: { organizationId: org.id } }),
    ]);
    assert.deepEqual(after, before, 'Denied mobile POST must not create a receipt, request or email');
    await prisma.mobileSession.delete({ where: { id: session.id } });
  } finally {
    await prisma.$disconnect();
  }
});
