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
