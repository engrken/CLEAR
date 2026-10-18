// POST /orgs/:org/payments with Ken's Collections rules (lib/mobile/payments.ts
// mirrors collections/actions.ts recordPayment): single items, the departmental
// package split, penalties, org-wide OR uniqueness, overpayment, closed periods,
// bad input; GET /fees grouping; GET /payments/next-or; and the
// whole-package → cleared-with-QR flow.
//
// Seed (prisma/seed-dev.js): Membership = Membership Fee 150 (General Fund) +
// Org Shirt 350 (Activity Fund), both isPackage; Event = Acquaintance Party 200
// (Activity Fund), a lone package item.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AY, FEE_CENTAVOS, TERM,
  api, assertLedgerEntry, expectAnyError, expectError, expectStatus, feeRow, orgRow, prisma, resetData,
  schoolId, signIn, studentRow, uniq,
} from './helpers.mjs';

const PACKAGE_NAME = 'Departmental Fee Package (All Items)';
const PACKAGE_FUND_LABEL = 'Multiple Funds (Package Split)';

let token;
let orgId;
let students; // school ID → Student (API shape)
let fees; // name → FeeItem from GET /fees
let feeIds; // name → CollectionSetup id (individual items, even when grouped in /fees)
let packageFee; // the Membership package pseudo-item

before(async () => {
  await resetData();
  token = (await signIn('devdept', 'treasurer')).token;
  orgId = (await orgRow('devdept')).id;
  const list = expectStatus(await api('GET', '/orgs/devdept/students', { token }), 200);
  students = Object.fromEntries(list.map((s) => [s.studentId, s]));
  const feeList = expectStatus(await api('GET', '/orgs/devdept/fees'), 200);
  fees = Object.fromEntries(feeList.map((f) => [f.name, f]));
  packageFee = feeList.find((f) => f.name === PACKAGE_NAME && f.category === 'Membership');
  feeIds = {};
  for (const name of Object.keys(FEE_CENTAVOS)) feeIds[name] = (await feeRow('devdept', name)).id;
});
after(() => prisma.$disconnect());

const post = (json) => api('POST', '/orgs/devdept/payments', { token, json });

/** Pays by fee name (individual CollectionSetup id) or 'package' (the Membership package pseudo-item). */
const pay = (n, feeName, amountCentavos, orNumber = uniq('OR')) =>
  post({
    studentId: students[schoolId('devdept', n)].id,
    feeId: feeName === 'package' ? packageFee.id : feeIds[feeName],
    amountCentavos,
    orNumber,
  });

/** Today's Manila calendar date at 12:00 UTC, as Ken stores payment dates. */
const manilaNoon = () => `${new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)}T12:00:00.000Z`;

describe('GET /orgs/:org/fees (Ken grouping)', () => {
  it('groups 2+ isPackage items of a category into the package pseudo-item', () => {
    assert.ok(packageFee, 'Membership package pseudo-item missing');
    assert.match(packageFee.id, /^package:/);
    assert.equal(packageFee.amountCentavos, FEE_CENTAVOS['Membership Fee'] + FEE_CENTAVOS['Org Shirt']);
    assert.equal(packageFee.targetFund, PACKAGE_FUND_LABEL);
    assert.equal(packageFee.kind, 'package');
    assert.equal(packageFee.isPackage, true);
    assert.deepEqual(packageFee.packageItems.map((i) => i.name), ['Membership Fee', 'Org Shirt']);
    assert.deepEqual(packageFee.packageItems.map((i) => i.amountCentavos), [15000, 35000]);
  });

  it('also lists every item, as Ken\'s web form does (package first)', () => {
    assert.equal(fees['Acquaintance Party']?.amountCentavos, FEE_CENTAVOS['Acquaintance Party']);
    assert.equal(fees['Acquaintance Party'].kind, 'item');
    assert.equal(fees['Acquaintance Party'].targetFund, 'Activity Fund');
    assert.equal(fees['Membership Fee']?.kind, 'item');
    assert.equal(fees['Org Shirt']?.isPackage, true);
    assert.equal(Object.keys(fees).length, 4);
  });

  it('a standalone (isPackage false) item is listed by itself', async () => {
    const setup = await prisma.collectionSetup.create({ data: {
      organizationId: orgId, academicYear: AY, term: TERM, category: 'Membership',
      name: 'Org Pin', amount: 50, targetFund: 'Activity Fund', isPackage: false,
    } });
    try {
      const list = expectStatus(await api('GET', '/orgs/devdept/fees'), 200);
      const pin = list.find((f) => f.id === setup.id);
      assert.equal(pin?.kind, 'item');
      assert.equal(pin.isPackage, false);
      const pkg = list.find((f) => f.name === PACKAGE_NAME && f.category === 'Membership');
      assert.equal(pkg.amountCentavos, 50000, 'a standalone item must not join the package');
    } finally {
      await prisma.collectionSetup.delete({ where: { id: setup.id } });
    }
  });
});

describe('POST /orgs/:org/payments', () => {
  it('full payment → 201 LedgerEntry backed by a Collection row, log and receipt outbox', async () => {
    const orNumber = uniq('OR');
    const entry = expectStatus(await pay(1, 'Membership Fee', 15000, orNumber), 201);
    assertLedgerEntry(entry);
    assert.equal(entry.kind, 'collection');
    assert.equal(entry.amountCentavos, 15000);
    assert.equal(entry.reference, orNumber);
    assert.equal(entry.orNumber, orNumber);
    assert.equal(entry.paymentType, 'Full Payment');
    assert.equal(entry.balanceDueCentavos, 0);
    assert.equal(entry.lines.length, 1);

    const row = await prisma.collection.findUnique({ where: { id: entry.id } });
    assert.ok(row, 'LedgerEntry.id should be the Collection id');
    assert.equal(row.organizationId, orgId);
    assert.equal(row.orNumber, orNumber);
    assert.equal(row.amountPaid, 150);
    assert.equal(row.itemDescription, 'Membership Fee');
    assert.equal(row.category, 'Membership');
    assert.equal(row.fundAllocation, 'General Fund');
    assert.equal(row.balanceDue, 0);
    assert.equal(row.paymentType, 'Full Payment');
    assert.equal(row.date.toISOString(), manilaNoon());

    const log = await prisma.systemLog.findFirst({ where: { organizationId: orgId, action: 'RECORD_PAYMENT', details: { startsWith: `OR ${orNumber}:` } } });
    assert.ok(log, 'RECORD_PAYMENT SystemLog row missing');
    const outbox = await prisma.digitalReceiptDelivery.count({ where: { organizationId: orgId, eventKey: `payment:${orNumber}` } });
    assert.ok(outbox >= 1, 'digital receipt should be queued in the same transaction');

    const ledger = expectStatus(await api('GET', '/orgs/devdept/ledger', { token }), 200);
    assert.equal(ledger[0]?.id, entry.id, 'the new payment should be the newest ledger entry');
  });

  it('paying an item that is already fully paid → 409 overpayment', async () => {
    expectError(await pay(1, 'Membership Fee', 15000), 409, 'overpayment');
  });

  it('partial payment is accepted and leaves a balance', async () => {
    const entry = expectStatus(await pay(2, 'Org Shirt', 10000), 201);
    assert.equal(entry.paymentType, 'Partial Payment');
    assert.equal(entry.balanceDueCentavos, 25000);
    const row = await prisma.collection.findUnique({ where: { id: entry.id } });
    assert.equal(row.balanceDue, 250);
  });

  it('an OR number is used once per department → 409 duplicate_or, nothing recorded', async () => {
    const orNumber = uniq('OR');
    expectStatus(await pay(2, 'Org Shirt', 5000, orNumber), 201);
    const before = await prisma.collection.count();
    expectError(await pay(2, 'Org Shirt', 5000, orNumber), 409, 'duplicate_or');
    expectError(await pay(3, 'Org Shirt', 5000, orNumber), 409, 'duplicate_or');
    expectError(await pay(3, 'Acquaintance Party', 5000, orNumber), 409, 'duplicate_or');
    expectError(await pay(3, 'Org Shirt', 5000, ` ${orNumber.toLowerCase()} `), 409, 'duplicate_or');
    assert.equal(await prisma.collection.count(), before);
  });

  it('badly formatted OR numbers → 400 invalid', async () => {
    for (const orNumber of ['AB', 'OR#123', '-OR-1', 'OR 123', 'X'.repeat(52)]) {
      expectError(await pay(4, 'Acquaintance Party', 1000, orNumber), 400, 'invalid');
    }
  });

  it('overpaying an item → 409 overpayment', async () => {
    expectError(await pay(4, 'Acquaintance Party', FEE_CENTAVOS['Acquaintance Party'] + 1), 409, 'overpayment');
    // Student 2's shirt: 15000 paid above, 20000 remaining.
    expectError(await pay(2, 'Org Shirt', 20001), 409, 'overpayment');
  });

  it('accepts the school student ID (any case) as well as the row id', async () => {
    const entry = expectStatus(await post({
      studentId: schoolId('devdept', 4).toLowerCase(), feeId: feeIds['Acquaintance Party'],
      amountCentavos: 5000, orNumber: uniq('OR'),
    }), 201);
    const row = await prisma.collection.findUnique({ where: { id: entry.id } });
    assert.equal(row.studentId, (await studentRow('devdept', 4)).id);
  });

  it('bad amounts → 400 invalid', async () => {
    for (const amountCentavos of [0, -100, 150.5, '15000x', null]) {
      expectError(await pay(4, 'Membership Fee', amountCentavos), 400, 'invalid');
    }
  });

  it('missing OR number → 400 invalid', async () => {
    expectError(await pay(4, 'Membership Fee', 15000, ''), 400, 'invalid');
    expectError(await pay(4, 'Membership Fee', 15000, '   '), 400, 'invalid');
  });

  it('unknown student → 422 invalid_student', async () => {
    const res = await post({ studentId: '00000000-0000-0000-0000-000000000000', feeId: feeIds['Membership Fee'], amountCentavos: 15000, orNumber: uniq('OR') });
    expectError(res, 422, 'invalid_student');
  });

  it('unknown fee or package id → 400/404', async () => {
    for (const feeId of ['no-such-fee', 'package:no-such-fee', `package:${feeIds['Acquaintance Party']}x`]) {
      expectAnyError(await post({ studentId: students[schoolId('devdept', 4)].id, feeId, amountCentavos: 1000, orNumber: uniq('OR') }), [400, 404]);
    }
  });

  it('no token → 401 unauthorized', async () => {
    const res = await api('POST', '/orgs/devdept/payments', {
      json: { studentId: students[schoolId('devdept', 4)].id, feeId: feeIds['Membership Fee'], amountCentavos: 15000, orNumber: uniq('OR') },
    });
    expectError(res, 401, 'unauthorized');
  });
});

describe('departmental package', () => {
  let packageOr;

  it('splits a package payment across the package items under one OR (-P02 lines)', async () => {
    packageOr = uniq('PKG');
    const entry = expectStatus(await pay(3, 'package', 20000, packageOr), 201);
    assert.equal(entry.amountCentavos, 20000, 'the entry amount is the whole receipt');
    assert.equal(entry.subtitle, PACKAGE_NAME);
    assert.equal(entry.reference, packageOr);
    assert.equal(entry.balanceDueCentavos, 30000);
    assert.equal(entry.paymentType, 'Partial Payment');
    assert.deepEqual(entry.lines.map((l) => [l.orNumber, l.itemDescription, l.fundAllocation, l.amountCentavos]), [
      [packageOr, 'Membership Fee', 'General Fund', 15000],
      [`${packageOr}-P02`, 'Org Shirt', 'Activity Fund', 5000],
    ]);

    const rows = await prisma.collection.findMany({
      where: { organizationId: orgId, OR: [{ orNumber: packageOr }, { orNumber: { startsWith: `${packageOr}-P` } }] },
      orderBy: { orNumber: 'asc' },
    });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].id, entry.id);
    assert.deepEqual(rows.map((r) => [r.paymentType, r.balanceDue, r.category]), [
      ['Full Payment', 0, 'Membership'],
      ['Partial Payment', 300, 'Membership'],
    ]);
  });

  it('a package line number cannot be reused as an OR', async () => {
    expectError(await pay(4, 'Acquaintance Party', 1000, `${packageOr}-P02`), 409, 'duplicate_or');
  });

  it('overpaying the package → 409 overpayment', async () => {
    expectError(await pay(3, 'package', 30001), 409, 'overpayment');
  });

  it('items already paid individually reduce the package balance', async () => {
    // Student 1 paid the Membership Fee alone above: only the shirt is left.
    const entry = expectStatus(await pay(1, 'package', 35000), 201);
    assert.equal(entry.lines.length, 1);
    assert.equal(entry.lines[0].itemDescription, 'Org Shirt');
    assert.equal(entry.balanceDueCentavos, 0);
    assert.equal(entry.paymentType, 'Full Payment');
  });
});

describe('penalty payments (penaltyId, added after app 1.0.0)', () => {
  let penalty;

  before(async () => {
    const s = await studentRow('devdept', 4);
    penalty = await prisma.penalty.create({ data: {
      organizationId: orgId, penaltyId: uniq('PEN'), academicYear: AY, term: TERM,
      studentId: s.studentId, studentName: s.fullName, activity: 'General Assembly',
      hoursLate: 2, ratePerHour: 50, fineAmount: 100, status: 'Unsettled',
    } });
  });

  const payPenalty = (n, amountCentavos, orNumber = uniq('OR')) =>
    post({ studentId: students[schoolId('devdept', n)].id, penaltyId: penalty.penaltyId, amountCentavos, orNumber });

  it('records a Penalty Fund receipt and lowers the fine', async () => {
    const entry = expectStatus(await payPenalty(4, 6000), 201);
    assert.equal(entry.subtitle, `Penalty Fine [${penalty.penaltyId}]: General Assembly`);
    assert.equal(entry.balanceDueCentavos, 4000);
    const row = await prisma.collection.findUnique({ where: { id: entry.id } });
    assert.equal(row.fundAllocation, 'Penalty Fund');
    assert.equal(row.category, 'Others');
    const pen = await prisma.penalty.findUnique({ where: { id: penalty.id } });
    assert.equal(pen.fineAmount, 40);
    assert.equal(pen.status, 'Partially Paid (Cash Payment)');
    const event = await prisma.penaltySettlementEvent.findFirst({ where: { penaltyRecordId: penalty.id, receiptId: entry.id } });
    assert.ok(event, 'PenaltySettlementEvent missing');
  });

  it('rejects overpaying the fine and another student', async () => {
    expectError(await payPenalty(4, 4001), 409, 'overpayment');
    expectError(await payPenalty(5, 1000), 422, 'invalid_student');
  });

  it('settles the fine, then refuses further payments', async () => {
    expectStatus(await payPenalty(4, 4000), 201);
    const pen = await prisma.penalty.findUnique({ where: { id: penalty.id } });
    assert.equal(pen.fineAmount, 0);
    assert.equal(pen.status, 'Settled (Cash Payment)');
    expectError(await payPenalty(4, 100), 409, 'conflict');
  });
});

describe('closed accounting period', () => {
  it('a period closed by a carry-over → 409 period_closed, nothing recorded', async () => {
    const t = await prisma.academicPeriodTransition.create({ data: {
      organizationId: orgId, sourceAY: AY, sourceTerm: TERM, destinationAY: AY, destinationTerm: '2nd Sem',
      reason: 'test', closedBy: 'test', status: 'Closed',
    } });
    try {
      const before = await prisma.collection.count();
      expectError(await pay(4, 'Acquaintance Party', 1000), 409, 'period_closed');
      assert.equal(await prisma.collection.count(), before);
    } finally {
      await prisma.academicPeriodTransition.delete({ where: { id: t.id } });
    }
  });
});

describe('GET /orgs/:org/payments/next-or', () => {
  it('suggests the next YY-NNN after the highest issued in the A.Y.', async () => {
    const first = expectStatus(await api('GET', '/orgs/devdept/payments/next-or', { token }), 200);
    assert.equal(first.suggestedOr, '26-001');
    expectStatus(await pay(5, 'Acquaintance Party', 1000, '26-041'), 201);
    const next = expectStatus(await api('GET', '/orgs/devdept/payments/next-or', { token }), 200);
    assert.equal(next.suggestedOr, '26-042');
  });

  it('no token → 401 unauthorized', async () => {
    expectError(await api('GET', '/orgs/devdept/payments/next-or'), 401, 'unauthorized');
  });
});

describe('paying the whole package clears the student', () => {
  it('public clearance → cleared with an absolute, signed verification URL as qrToken', async () => {
    // Student 5 paid 1000 of the Acquaintance Party above.
    expectStatus(await pay(5, 'package', packageFee.amountCentavos), 201);
    expectStatus(await pay(5, 'Acquaintance Party', FEE_CENTAVOS['Acquaintance Party'] - 1000), 201);

    const id = schoolId('devdept', 5);
    const pub = expectStatus(await api('GET', `/orgs/devdept/clearance?q=${id}`), 200);
    assert.equal(pub.status, 'cleared');
    assert.equal(pub.outstandingCentavos, null);
    assert.equal(typeof pub.qrToken, 'string');
    const url = new URL(pub.qrToken); // throws if not absolute
    assert.equal(url.pathname, '/department/devdept/clearance');
    assert.ok(url.searchParams.get('sig'), 'qrToken should carry a signature');
    assert.equal(url.searchParams.get('q'), id);

    const officer = expectStatus(await api('GET', `/orgs/devdept/clearance?q=${id}`, { token }), 200);
    assert.equal(officer.outstandingCentavos, 0);
  });
});
