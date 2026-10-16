// Officer read endpoints: dashboard, ledger and students: shapes, integer money,
// ordering, limits and search.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AY, PACKAGE_CENTAVOS, TERM,
  api, assertCentavos, assertLedgerEntry, expectStatus, feeRow, orgRow, prisma, resetData, schoolId,
  signIn, studentRow, submitProof, uniq,
} from './helpers.mjs';

let token;

before(async () => {
  await resetData();
  token = (await signIn('devdept', 'admin')).token;
});
after(() => prisma.$disconnect());

const MONEY_FIELDS = ['cashOnHandCentavos', 'safekeepingCentavos', 'pendingCentavos', 'outstandingCentavos'];
const COUNT_FIELDS = ['pendingCount', 'outstandingStudents', 'collectionsToday'];

const dashboard = async () => expectStatus(await api('GET', '/orgs/devdept/dashboard', { token }), 200);

async function pay(n, feeName, amountCentavos) {
  const student = await studentRow('devdept', n);
  const fee = await feeRow('devdept', feeName);
  return expectStatus(
    await api('POST', '/orgs/devdept/payments', {
      token,
      json: { studentId: student.id, feeId: fee.id, amountCentavos, orNumber: uniq('OR') },
    }),
    201
  );
}

describe('GET /orgs/:org/dashboard', () => {
  it('returns DashboardSummary with integer money fields plus ay/term', async () => {
    const d = await dashboard();
    for (const k of [...MONEY_FIELDS, ...COUNT_FIELDS]) assertCentavos(d[k], k);
    assert.equal(d.ay, AY);
    assert.equal(d.term, TERM);
  });

  it('fresh seed: every student owes the full package, nothing pending', async () => {
    const d = await dashboard();
    assert.equal(d.outstandingStudents, 5);
    assert.equal(d.outstandingCentavos, 5 * PACKAGE_CENTAVOS);
    assert.equal(d.pendingCount, 0);
    assert.equal(d.pendingCentavos, 0);
  });

  it('a submitted proof raises pendingCount / pendingCentavos', async () => {
    const before = await dashboard();
    await submitProof('devdept', { studentId: schoolId('devdept', 1), amountCentavos: 12345 });
    const after = await dashboard();
    assert.equal(after.pendingCount, before.pendingCount + 1);
    assert.equal(after.pendingCentavos, before.pendingCentavos + 12345);
  });

  it('a payment lowers outstandingCentavos by the amount paid', async () => {
    const before = await dashboard();
    await pay(2, 'Membership Fee', 15000);
    const after = await dashboard();
    assert.equal(after.outstandingCentavos, before.outstandingCentavos - 15000);
    assert.ok(after.collectionsToday >= before.collectionsToday);
  });

  it("other org's activity does not move devdept's numbers", async () => {
    const before = await dashboard();
    await submitProof('otherdept', { studentId: schoolId('otherdept', 1), amountCentavos: 99900 });
    const after = await dashboard();
    assert.deepEqual(after, before);
  });
});

describe('GET /orgs/:org/ledger', () => {
  before(async () => {
    await pay(3, 'Org Shirt', 10000);
    await submitProof('devdept', { studentId: schoolId('devdept', 4), amountCentavos: 20000, itemDescription: 'Acquaintance Party' });
    await pay(3, 'Org Shirt', 5000);
  });

  it('returns LedgerEntry[] with integer centavos, newest first', async () => {
    const ledger = expectStatus(await api('GET', '/orgs/devdept/ledger', { token }), 200);
    assert.ok(Array.isArray(ledger));
    assert.ok(ledger.length >= 5, `expected the seeded activity, got ${ledger.length} entries`);
    for (const e of ledger) assertLedgerEntry(e);
    const times = ledger.map((e) => Date.parse(e.at));
    for (let i = 1; i < times.length; i++) {
      assert.ok(times[i - 1] >= times[i], `ledger not newest-first at index ${i}`);
    }
    assert.ok(ledger.some((e) => e.kind === 'collection'));
    assert.ok(ledger.some((e) => e.kind === 'online-remittance'));
  });

  it('limit caps the number of entries', async () => {
    const one = expectStatus(await api('GET', '/orgs/devdept/ledger?limit=1', { token }), 200);
    assert.equal(one.length, 1);
    const two = expectStatus(await api('GET', '/orgs/devdept/ledger?limit=2', { token }), 200);
    assert.equal(two.length, 2);
    assert.equal(two[0].id, one[0].id);
  });

  it('limit above 200 is clamped or rejected, never honoured', async () => {
    const res = await api('GET', '/orgs/devdept/ledger?limit=100000', { token });
    if (res.status === 200) assert.ok(res.data.length <= 200);
    else assert.equal(res.status, 400, JSON.stringify(res.data));
  });

  it('garbage limit does not cause a server error', async () => {
    const res = await api('GET', '/orgs/devdept/ledger?limit=abc', { token });
    assert.ok([200, 400].includes(res.status), `got HTTP ${res.status}`);
  });
});

describe('GET /orgs/:org/students', () => {
  it('returns the roster as Student[] with active-term status', async () => {
    const list = expectStatus(await api('GET', '/orgs/devdept/students', { token }), 200);
    assert.equal(list.length, 5);
    for (const s of list) {
      assert.equal(typeof s.id, 'string');
      assert.match(s.studentId, /^DEV-2026-\d{4}$/);
      assert.equal(typeof s.fullName, 'string');
      assert.equal(typeof s.yearLevel, 'string');
      assert.equal(s.enrollmentStatus, 'Enrolled');
    }
  });

  it('q filters by name and by school ID', async () => {
    const byName = expectStatus(await api('GET', '/orgs/devdept/students?q=Ana', { token }), 200);
    assert.deepEqual(byName.map((s) => s.fullName), ['Ana Reyes']);
    const byId = expectStatus(await api('GET', `/orgs/devdept/students?q=${schoolId('devdept', 3)}`, { token }), 200);
    assert.deepEqual(byId.map((s) => s.fullName), ['Carla Cruz']);
  });

  it("a non-enrolled status maps to 'Dropped'", async () => {
    const org = await orgRow('devdept');
    const student = await studentRow('devdept', 5);
    await prisma.enrollment.updateMany({
      where: { organizationId: org.id, studentId: student.id },
      data: { enrollmentStatus: 'Leave of Absence' },
    });
    const list = expectStatus(await api('GET', `/orgs/devdept/students?q=${student.studentId}`, { token }), 200);
    assert.equal(list[0]?.enrollmentStatus, 'Dropped');
  });
});
