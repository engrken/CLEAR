// Authenticated finance API integration in disposable CI PostgreSQL only.
// Four read-only modules, cross-tenant/role/session denials and exact centavos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const isolatedDb = 'postgresql://clear_ci:clear_ci@127.0.0.1:5432/clear_ci?schema=public';
if (process.env.CI !== 'true' ||
    process.env.CLEAR_CI_FINANCE_TEST_ENABLED !== '1' ||
    process.env.DATABASE_URL !== isolatedDb ||
    process.env.AUTH_URL !== 'http://127.0.0.1:3100') {
  throw new Error('REFUSING finance review integration test outside isolated CI.');
}
const prisma = new PrismaClient();
const base = 'http://127.0.0.1:3100';
const academicYear = 'A.Y. CI 2026 - 2027';
const term = '1st Sem';
const grants = {
  penalties: 'tab-penalties',
  advances: 'tab-advances',
  liquidations: 'tab-audit',
  collections: 'tab-payment',
};

async function createSession(org, allowedTabs, role = 'Officer') {
  const id = randomUUID();
  const officer = await prisma.tenantUser.create({
    data: { organizationId: org.id, userId: 'CI-REVIEW-' + id,
      fullName: 'CI Authorized Test Officer', username: 'ci_review_' + id,
      email: 'ci-review-' + id + '@example.invalid', status: 'Active',
      role, allowedTabs: JSON.stringify(allowedTabs) },
  });
  const token = 'clr_' + randomBytes(32).toString('base64url');
  const session = await prisma.mobileSession.create({
    data: { id: randomUUID(),
      tokenHash: createHash('sha256').update(token).digest('hex'),
      tenantUserId: officer.id, organizationId: org.id,
      expiresAt: new Date(Date.now() + 600_000) },
  });
  return { token, sessionId: session.id };
}
async function get(slug, kind, token, limit = 20) {
  const url = new URL(base + '/api/mobile/orgs/' + slug + '/finance-review');
  url.searchParams.set('kind', kind);
  url.searchParams.set('limit', String(limit));
  const res = await fetch(url, {
    headers: token ? { authorization: 'Bearer ' + token } : {},
    signal: AbortSignal.timeout(15_000),
  });
  return { status: res.status, body: await res.json() };
}

test('financial review GETs enforce tenant, module, sessions, period, integrity and no financial mutations', {
  timeout: 120_000,
}, async () => {
  const suffix = randomUUID().slice(0, 8);
  const slug = 'ci-review-a-' + suffix;
  const otherSlug = 'ci-review-b-' + suffix;
  const org = await prisma.organization.create({ data: {
    subdomain: slug, name: 'CI Finance Review Tenant', status: 'Active',
    activeAy: academicYear, activeTerm: term,
  } });
  const other = await prisma.organization.create({ data: {
    subdomain: otherSlug, name: 'CI Other Tenant', status: 'Active',
    activeAy: academicYear, activeTerm: term,
  } });
  try {
    const tokens = {};
    for (const [kind, tab] of Object.entries(grants)) {
      tokens[kind] = await createSession(org, [tab]);
    }
    const outsider = await createSession(other, ['tab-penalties']);
    const noFinance = await createSession(org, ['tab-students']);
    const revoked = await createSession(org, ['tab-penalties']);
    const expired = await createSession(org, ['tab-penalties']);
    await prisma.mobileSession.update({
      where: { id: revoked.sessionId }, data: { revokedAt: new Date() },
    });
    await prisma.mobileSession.update({
      where: { id: expired.sessionId }, data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await prisma.penalty.create({ data: {
      organizationId: org.id, academicYear, term,
      penaltyId: 'CI-REVIEW-PEN-' + suffix,
      studentName: 'CI Private Finance Student', activity: 'CI Synthetic',
      fineAmount: 221.67, assessedAmount: 221.67, status: 'Unsettled',
    } });
    await prisma.penalty.create({ data: {
      organizationId: org.id, academicYear: 'A.Y. CI Prior', term: 'Prior Term',
      penaltyId: 'CI-REVIEW-OLD-' + suffix,
      studentName: 'CI Old Private Finance Student', activity: 'CI Prior',
      fineAmount: 999.99, status: 'Unsettled',
    } });
    await prisma.penalty.create({ data: {
      organizationId: other.id, academicYear, term,
      penaltyId: 'CI-REVIEW-FOREIGN-' + suffix,
      studentName: 'CI Foreign Finance Student', activity: 'CI Foreign',
      fineAmount: 777.77, status: 'Unsettled',
    } });
    await prisma.cashAdvance.create({ data: {
      organizationId: org.id, academicYear, term,
      advanceId: 'CI-REVIEW-ADV-' + suffix,
      requestor: 'CI Synthetic Officer', fundSource: 'CI Synthetic Fund',
      amountApproved: 400.25, purpose: 'CI Synthetic',
    } });
    await prisma.audit.create({ data: {
      organizationId: org.id, academicYear, term,
      auditId: 'CI-REVIEW-AUD-' + suffix,
      referenceCaId: 'CI-REVIEW-ADV-' + suffix,
      requestor: 'CI Synthetic Officer', fundSource: 'CI Synthetic Fund',
      totalExpense: 317.60,
    } });
    for (const [index, amountPaid] of [100.25,25.10].entries()) {
      await prisma.collection.create({ data: {
        organizationId: org.id, academicYear, term,
        orNumber: 'CI-REVIEW-OR-' + suffix,
        studentName: 'CI Private Finance Student',
        category: 'CI Synthetic', itemDescription: 'CI Allocation ' + index,
        paymentType: 'Full Payment', fundAllocation: 'CI Fund',
        amountPaid, balanceDue: 0, status: 'Valid',
      } });
    }
    assert.equal((await get(slug, 'penalties')).status, 401);
    assert.equal((await get(slug, 'penalties', noFinance.token)).status, 403);
    assert.equal((await get(slug, 'penalties', outsider.token)).status, 403);
    assert.equal((await get(slug, 'penalties', revoked.token)).status, 401);
    assert.equal((await get(slug, 'penalties', expired.token)).status, 401);
    assert.equal((await get(slug, 'not-a-real-module', tokens.penalties.token)).status, 400);
    assert.equal((await get(slug, 'penalties', tokens.penalties.token, 41)).status, 400);
    assert.equal((await get(slug, 'penalties', tokens.penalties.token, 0)).status, 400);

    const counts = async () => Promise.all([
      prisma.penalty.count({ where: { organizationId: org.id } }),
      prisma.cashAdvance.count({ where: { organizationId: org.id } }),
      prisma.audit.count({ where: { organizationId: org.id } }),
      prisma.collection.count({ where: { organizationId: org.id } }),
    ]);
    const before = await counts();
    const expected = {
      penalties: [22167],
      advances: [40025],
      liquidations: [31760],
      collections: [10025, 2510],
    };
    for (const [kind, tokenInfo] of Object.entries(tokens)) {
      const correct = await get(slug, kind, tokenInfo.token);
      assert.equal(correct.status, 200, kind + ' ' + JSON.stringify(correct.body));
      assert.equal(correct.body.kind, kind);
      assert.equal(correct.body.scope, 'active_period');
      assert.equal(correct.body.ay, academicYear);
      assert.equal(correct.body.term, term);
      assert.equal(correct.body.hasMore, false);
      assert.deepEqual(correct.body.entries.map(r => r.amountCentavos).sort((a,b) => a-b),
        expected[kind].slice().sort((a,b) => a-b));
      assert.ok(correct.body.entries.every(r => Number.isSafeInteger(r.amountCentavos)));
      assert.ok(correct.body.entries.every(r =>
        !r.title.includes('Foreign') && !r.title.includes('Old Private')));
      // A granted collection tab cannot read penalty/advance/audit records.
      for (const [otherKind] of Object.entries(grants)) {
        if (otherKind === kind) continue;
        assert.equal((await get(slug, otherKind, tokenInfo.token)).status, 403);
      }
    }
    assert.deepEqual(await counts(), before, 'GET requests must not mutate finance records');
  } finally {
    await prisma.organization.delete({ where: { id: org.id } });
    await prisma.organization.delete({ where: { id: other.id } });
    await prisma.$disconnect();
  }
});
