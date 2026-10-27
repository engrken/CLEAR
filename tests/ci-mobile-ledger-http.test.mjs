// Real GET /api/mobile ledger acceptance using ONLY a disposable local CircleCI
// PostgreSQL container. Invalid legacy penalty duration exercises the actual 422
// route without fabricating sub-cent values in a numeric(18,2) database column.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const expectedDatabase = 'postgresql://clear_ci:clear_ci@127.0.0.1:5432/clear_ci?schema=public';
if (process.env.CI !== 'true' ||
    process.env.CLEAR_CI_FINANCE_TEST_ENABLED !== '1' ||
    process.env.DATABASE_URL !== expectedDatabase ||
    process.env.AUTH_URL !== 'http://127.0.0.1:3100') {
  throw new Error('REFUSING ledger integration test outside the isolated CI database and HTTP server.');
}

const prisma = new PrismaClient();
const root = 'http://127.0.0.1:3100';
const ay = 'A.Y. CI 2026 - 2027';
const term = '1st Sem';

function sessionToken() {
  return 'clr_' + randomBytes(32).toString('base64url');
}

async function createOfficerSession(org, role, tabs) {
  const suffix = randomUUID();
  const officer = await prisma.tenantUser.create({
    data: {
      organizationId: org.id, userId: 'CI-' + suffix,
      fullName: 'CI Test Officer', username: 'ci_' + suffix,
      email: 'ci-' + suffix + '@example.invalid',
      role, status: 'Active', allowedTabs: JSON.stringify(tabs),
    },
  });
  const token = sessionToken();
  await prisma.mobileSession.create({
    data: {
      id: randomUUID(),
      tokenHash: createHash('sha256').update(token).digest('hex'),
      tenantUserId: officer.id, organizationId: org.id,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  return token;
}

async function getLedger(slug, token) {
  const response = await fetch(root + '/api/mobile/orgs/' + slug + '/ledger?limit=100', {
    headers: token ? { authorization: 'Bearer ' + token } : {},
    signal: AbortSignal.timeout(15000),
  });
  return { status: response.status, payload: await response.json() };
}

function penaltyFixture(org, overrides = {}) {
  return {
    organizationId: org.id, penaltyId: 'CI-LEDGER-' + randomUUID(),
    academicYear: ay, term,
    studentName: 'CI Private Ledger Sentinel', activity: 'CI Synthetic Penalty',
    hoursLate: 4.4333, ratePerHour: 50, fineAmount: 221.67,
    assessedAmount: null, penaltyType: 'SERVICE_ELIGIBLE',
    status: 'Unsettled', ...overrides,
  };
}

test('real tenant-scoped mobile ledger: exact cents, safe 422 and no financial side effects', {
  timeout: 120000,
}, async () => {
  const tenantSuffix = randomUUID().slice(0, 8);
  const slug = 'ci-ledger-a-' + tenantSuffix;
  const foreignSlug = 'ci-ledger-b-' + tenantSuffix;
  const owned = [];
  try {
    const first = await prisma.organization.create({
      data: { subdomain: slug, name: 'CI Ledger A', activeAy: ay, activeTerm: term, status: 'Active' },
    });
    owned.push(first.id);
    const other = await prisma.organization.create({
      data: { subdomain: foreignSlug, name: 'CI Ledger B', activeAy: ay, activeTerm: term, status: 'Active' },
    });
    owned.push(other.id);

    const authorized = await createOfficerSession(first, 'Admin', ['tab-overview']);
    const restricted = await createOfficerSession(first, 'Officer', ['tab-students']);
    const foreignOfficer = await createOfficerSession(other, 'Admin', ['tab-overview']);

    const missing = await getLedger(slug);
    assert.equal(missing.status, 401, JSON.stringify(missing.payload));
    const denied = await getLedger(slug, restricted);
    assert.equal(denied.status, 403, JSON.stringify(denied.payload));
    const crossTenant = await getLedger(slug, foreignOfficer);
    assert.equal(crossTenant.status, 403, JSON.stringify(crossTenant.payload));
    const empty = await getLedger(foreignSlug, foreignOfficer);
    assert.equal(empty.status, 200, JSON.stringify(empty.payload));
    assert.deepEqual(empty.payload, []);

    const duration = await prisma.penalty.create({ data: penaltyFixture(first) });
    const lateFee = await prisma.penalty.create({
      data: penaltyFixture(first, {
        hoursLate: 0, ratePerHour: 0, fineAmount: 5.55, penaltyType: 'LATE_FEE',
      }),
    });
    const valid = await getLedger(slug, authorized);
    assert.equal(valid.status, 200, JSON.stringify(valid.payload));
    assert.ok(Array.isArray(valid.payload));
    const reconstructed = valid.payload.find((entry) => entry.reference === duration.penaltyId);
    assert.ok(reconstructed, 'Legacy penalty missing from scoped ledger');
    assert.equal(reconstructed.amountCentavos, 22167);
    assert.equal(reconstructed.assessedCentavos, 22167);
    const flat = valid.payload.find((entry) => entry.reference === lateFee.penaltyId);
    assert.ok(flat, 'Legacy flat-fee penalty missing from scoped ledger');
    assert.equal(flat.amountCentavos, 555);
    assert.equal(Object.hasOwn(flat, 'assessedCentavos'), false,
      'Unknown historical flat assessment must not be shown as zero');

    const corrupt = await prisma.penalty.create({
      data: penaltyFixture(first, {
        hoursLate: 4.4334, fineAmount: 1, penaltyId: 'CI-CORRUPT-' + randomUUID(),
      }),
    });
    const before = await Promise.all([
      prisma.collection.count({ where: { organizationId: first.id } }),
      prisma.penalty.count({ where: { organizationId: first.id } }),
      prisma.penaltySettlementEvent.count({ where: { organizationId: first.id } }),
      prisma.systemLog.count({ where: { organizationId: first.id } }),
    ]);

    const invalid = await getLedger(slug, authorized);
    assert.equal(invalid.status, 422, JSON.stringify(invalid.payload));
    assert.equal(invalid.payload.error?.code, 'financial_data_review');
    assert.match(invalid.payload.error?.message || '', /financial review/i);
    assert.doesNotMatch(JSON.stringify(invalid.payload), /CI Private Ledger Sentinel|CI-CORRUPT|4\.4334|221\.67/i,
      'Bad read error must not expose private student identifiers or monetary values');
    const after = await Promise.all([
      prisma.collection.count({ where: { organizationId: first.id } }),
      prisma.penalty.count({ where: { organizationId: first.id } }),
      prisma.penaltySettlementEvent.count({ where: { organizationId: first.id } }),
      prisma.systemLog.count({ where: { organizationId: first.id } }),
    ]);
    assert.deepEqual(after, before, 'Failed read must not change financial records');
    const persisted = await prisma.penalty.findUniqueOrThrow({ where: { id: corrupt.id } });
    assert.equal(persisted.hoursLate, 4.4334);
    assert.equal(persisted.fineAmount.toString(), '1');

    await prisma.penalty.delete({ where: { id: corrupt.id } });
    const restored = await getLedger(slug, authorized);
    assert.equal(restored.status, 200, JSON.stringify(restored.payload));
    assert.equal(restored.payload.find((entry) => entry.reference === duration.penaltyId)?.assessedCentavos, 22167);
  } finally {
    for (const id of owned.reverse()) {
      await prisma.organization.delete({ where: { id } });
    }
    await prisma.$disconnect();
  }
});

test('complete cross-period Activity keyset pagination has no gaps, duplicates or cross-tenant leaks', {
  timeout: 120000,
}, async () => {
  const suffix = randomUUID().slice(0, 8);
  const slug = 'ci-activity-' + suffix;
  const otherSlug = 'ci-activity-other-' + suffix;
  const org = await prisma.organization.create({
    data: { subdomain: slug, name: 'CI Activity Pagination',
      activeAy: ay, activeTerm: term, status: 'Active' },
  });
  const other = await prisma.organization.create({
    data: { subdomain: otherSlug, name: 'CI Activity Foreign',
      activeAy: ay, activeTerm: term, status: 'Active' },
  });
  try {
    const session = await createOfficerSession(org, 'Admin', ['tab-overview']);
    const otherSession = await createOfficerSession(other, 'Admin', ['tab-overview']);
    const viewer = await createOfficerSession(org, 'Officer', ['tab-students']);
    const overviewOnly = await createOfficerSession(org, 'Officer', ['tab-overview']);
    const when = new Date('2026-10-24T12:00:00.000Z');
    const collectionRows = Array.from({ length: 520 }, (_, i) => ({
      organizationId: org.id, academicYear: i < 507 ? ay : 'A.Y. CI Prior',
      term: i < 507 ? term : 'Prior Term',
      timestamp: when, date: when, studentName: 'CI Paginated Synthetic',
      orNumber: 'CI-PAGE-' + suffix + '-' + String(i).padStart(4, '0'),
      category: 'CI Test', itemDescription: 'Pagination test allocation',
      paymentType: 'Full Payment', fundAllocation: 'Synthetic Fund',
      amountPaid: 1.01, balanceDue: 0, status: 'Valid',
    }));
    await prisma.collection.createMany({ data: collectionRows });
    const penalties = Array.from({ length: 35 }, (_, i) => ({
      organizationId: org.id, academicYear: ay, term,
      penaltyId: 'CI-PAGE-PEN-' + suffix + '-' + String(i).padStart(4, '0'),
      date: when, studentName: 'CI Paginated Synthetic',
      activity: 'Pagination test fine', penaltyType: 'SERVICE_ELIGIBLE',
      hoursLate: 1, ratePerHour: 50, fineAmount: 50,
      assessedAmount: 50, status: 'Unsettled',
    }));
    await prisma.penalty.createMany({ data: penalties });

    const get = async (token, target, cursor, scope = 'all') => {
      const url = new URL(root + '/api/mobile/orgs/' + target + '/ledger/page');
      url.searchParams.set('limit', '50');
      url.searchParams.set('scope', scope);
      if (cursor) url.searchParams.set('cursor', cursor);
      const res = await fetch(url, {
        headers: token ? { authorization: 'Bearer ' + token } : {},
        signal: AbortSignal.timeout(15000),
      });
      return { status: res.status, body: await res.json() };
    };
    const absent = await get(null, slug);
    assert.equal(absent.status, 401);
    assert.equal((await get(viewer, slug)).status, 403);
    assert.equal((await get(overviewOnly, slug, undefined, 'all')).status, 403);
    assert.equal((await get(overviewOnly, slug, undefined, 'active')).status, 200);
    assert.equal((await get(otherSession, slug)).status, 403);

    const observed = [];
    let cursor;
    for (let page = 0; page < 15; page++) {
      const resp = await get(session, slug, cursor);
      assert.equal(resp.status, 200, JSON.stringify(resp.body));
      assert.ok(resp.body.records.length <= 50);
      assert.equal(resp.body.scope, 'all');
      observed.push(...resp.body.records);
      if (!resp.body.hasMore) {
        assert.equal(resp.body.nextCursor, null);
        break;
      }
      assert.ok(typeof resp.body.nextCursor === 'string');
      cursor = resp.body.nextCursor;
      if (page === 0) {
        // Every requested page must recheck the tenant, scope and tab grants.
        assert.equal((await get(otherSession, slug, cursor)).status, 403);
        assert.equal((await get(session, otherSlug, cursor)).status, 403);
        assert.equal((await get(session, slug, cursor, 'active')).status, 400);
        assert.equal((await get(session, slug, 'bad-!')).status, 400);
      }
    }
    assert.equal(observed.length, 555, 'All periods and both financial tables must be traversed');
    const keys = observed.map(r => r.kind + ':' + r.id);
    assert.equal(new Set(keys).size, 555, 'No duplicated pages at tied timestamps');
    assert.equal(observed.filter(r => r.kind === 'collection').length, 520);
    assert.equal(observed.filter(r => r.kind === 'penalty').length, 35);
    assert.equal(observed.filter(r => r.academicYear === 'A.Y. CI Prior').length, 13,
      'Historic period records must remain reachable');
    assert.ok(observed.every(r => Number.isSafeInteger(r.amountCentavos)));
    assert.equal(await prisma.collection.count({ where: { organizationId: org.id } }), 520,
      'Activity GET cannot mutate or erase receipt rows');
    assert.equal(await prisma.penalty.count({ where: { organizationId: org.id } }), 35);
  } finally {
    await prisma.organization.delete({ where: { id: org.id } });
    await prisma.organization.delete({ where: { id: other.id } });
  }
});
