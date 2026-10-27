// CI-only synthetic maintenance state. Refuse to run outside disposable Postgres.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
const EXPECTED = 'postgresql://clear_ci:clear_ci@127.0.0.1:5432/clear_ci?schema=public';
if (process.env.CI !== 'true' || process.env.CLEAR_CI_FINANCE_TEST_ENABLED !== '1' ||
    process.env.DATABASE_URL !== EXPECTED || process.env.AUTH_URL !== 'http://127.0.0.1:3100') {
  throw new Error('REFUSED: maintenance test must use disposable CI database/server.');
}
const prisma = new PrismaClient();
const base = 'http://127.0.0.1:3100';
async function request(path, method='GET') {
  const res = await fetch(base + path, { method, signal: AbortSignal.timeout(16000) });
  return { status: res.status, body: await res.text() };
}
async function policy(scopeKey, mode, expiresAt=null) {
  return prisma.maintenancePolicy.upsert({ where: { scopeKey },
    create: { scopeKey, mode, reason: 'CI synthetic maintenance',
      updatedBy: 'ci@example.invalid', expiresAt },
    update: { mode, reason: 'CI synthetic maintenance',
      updatedBy: 'ci@example.invalid', expiresAt },
  });
}

test('maintenance HTTP: OFF, scoped READ_ONLY, global FULL, recovery, expiry and public notices', {
  timeout: 120000,
}, async () => {
  const beforeCollections = await prisma.collection.count();
  const beforePenalties = await prisma.penalty.count();
  try {
    await prisma.maintenancePolicy.deleteMany();
    const normal = await request('/api/maintenance/status?tenant=ci-financial');
    assert.equal(normal.status, 200, normal.body);
    assert.equal(JSON.parse(normal.body).mode, 'NORMAL');

    await policy('tenant:ci-financial','READ_ONLY');
    assert.equal(JSON.parse((await request('/api/maintenance/status?tenant=ci-financial')).body).mode,'READ_ONLY');
    assert.equal(JSON.parse((await request('/api/maintenance/status?tenant=other-ci-tenant')).body).mode,'NORMAL');
    // Only an OTP challenge is allowed to POST during READ_ONLY, never a
    // department page Server Action or a financial write.
    const challenge = await fetch(base + '/api/department/ci-financial/auth/request-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unregistered-ci@example.invalid' }),
      signal: AbortSignal.timeout(16000),
    });
    assert.equal(challenge.status, 200, await challenge.text());
    assert.equal((await request('/department/ci-financial','POST')).status, 503);
    const denied = await request('/api/mobile/orgs/ci-financial/payments','POST');
    assert.equal(denied.status,503,denied.body);
    assert.equal(JSON.parse(denied.body).error.code,'maintenance');
    assert.notEqual((await request('/api/mobile/orgs/ci-financial/ledger')).status,503);

    await policy('GLOBAL','FULL');
    assert.equal((await request('/api/department/ci-financial/auth/request-code','POST')).status,503,
      'Web OTP challenge is blocked during FULL, retaining operator recovery only');
    const full = await request('/api/mobile/orgs/ci-financial/ledger');
    assert.equal(full.status,503,full.body);
    assert.equal(JSON.parse(full.body).error.code,'maintenance');
    const landing = await request('/department/ci-financial');
    assert.equal(landing.status,200,landing.body.slice(0,200));
    assert.match(landing.body,/Scheduled system maintenance/i);
    const stateFull = await request('/api/maintenance/status?tenant=ci-financial');
    assert.equal(stateFull.status,200);
    assert.equal(JSON.parse(stateFull.body).mode,'FULL');
    assert.notEqual((await request('/api/auth/session')).status,503,'Global operator auth must remain reachable');

    await policy('GLOBAL','READ_ONLY');
    assert.equal(JSON.parse((await request('/api/maintenance/status?tenant=ci-financial')).body).mode,'READ_ONLY');
    await policy('GLOBAL','NORMAL');
    await policy('tenant:ci-financial','FULL',new Date(Date.now()-60000));
    assert.equal(JSON.parse((await request('/api/maintenance/status?tenant=ci-financial')).body).mode,'NORMAL');

    const now = new Date();
    const notice = await prisma.maintenanceNotice.create({ data: {
      scopeKey:'tenant:ci-financial',title:'CI synthetic maintenance notice',
      message:'This is a disposable CI-only notice, no actual outage.',
      startsAt:new Date(now.getTime()+60000),
      endsAt:new Date(now.getTime()+3600000),
      state:'SCHEDULED',createdBy:'ci@example.invalid',updatedBy:'ci@example.invalid',
    }});
    const own = JSON.parse((await request('/api/maintenance/status?tenant=ci-financial')).body);
    assert.ok(own.notices.some(n=>n.id===notice.id));
    const foreign = JSON.parse((await request('/api/maintenance/status?tenant=other-ci-tenant')).body);
    assert.ok(!foreign.notices.some(n=>n.id===notice.id));
    assert.equal((await request('/api/maintenance/notices?tenant=ci-financial')).status,200);
    assert.equal(await prisma.collection.count(),beforeCollections,'No receipt mutations');
    assert.equal(await prisma.penalty.count(),beforePenalties,'No penalty mutations');
  } finally {
    await prisma.maintenancePolicy.deleteMany();
    await prisma.maintenanceNotice.deleteMany();
    await prisma.maintenanceAudit.deleteMany();
    await prisma.$disconnect();
  }
});
