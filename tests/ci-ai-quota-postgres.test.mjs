import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();
test('PostgreSQL advisory lock enforces concurrent reservation ceilings on synthetic records', async () => {
  if (process.env.CI !== 'true' || !String(process.env.DATABASE_URL || '').includes('127.0.0.1')) {
    throw new Error('This test is permitted only against disposable CI PostgreSQL.');
  }
  const slug = 'ai-ci-' + randomUUID().slice(0, 12);
  const org = await prisma.organization.create({
    data: { subdomain: slug, name: 'Synthetic AI CI Organization', tier: 'Pro', status: 'Active' },
  });
  try {
    const email = 'synthetic-officer@example.invalid';
    await prisma.systemLog.createMany({
      data: Array.from({ length: 29 }, () => ({
        organizationId: org.id, user: email, action: 'AI_ASSISTANT_REQUEST', details: 'CI synthetic reservation',
      })),
    });
    async function reserve() {
      return prisma.$transaction(async tx => {
        const key = 'CLEAR_AI_TENANT_QUOTA:' + org.id;
        await tx.$queryRaw`SELECT 1::int AS acquired FROM pg_advisory_xact_lock(hashtextextended(${key}::text, 0))`;
        const [officerUsed, tenantUsed] = await Promise.all([
          tx.systemLog.count({ where: { organizationId: org.id, action: 'AI_ASSISTANT_REQUEST', user: email, timestamp: { gte: new Date(Date.now() - 86400000) } } }),
          tx.systemLog.count({ where: { organizationId: org.id, action: 'AI_ASSISTANT_REQUEST', timestamp: { gte: new Date(Date.now() - 86400000) } } }),
        ]);
        if (officerUsed >= 30 || tenantUsed >= 120) return false;
        await tx.systemLog.create({ data: { organizationId: org.id, user: email, action: 'AI_ASSISTANT_REQUEST' } });
        return true;
      }, { maxWait: 8000, timeout: 8000 });
    }
    const results = await Promise.all(Array.from({ length: 8 }, reserve));
    assert.equal(results.filter(Boolean).length, 1, 'only one of eight overlapping requests should be admitted');
    assert.equal(await prisma.systemLog.count({ where: { organizationId: org.id, action: 'AI_ASSISTANT_REQUEST' } }), 30);
  } finally {
    await prisma.systemLog.deleteMany({ where: { organizationId: org.id } });
    await prisma.organization.delete({ where: { id: org.id } });
  }
});
test.after(async () => { await prisma.$disconnect(); });
