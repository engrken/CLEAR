// POST /orgs/:org/payments: happy path, duplicate OR, overpay, fully paid, bad
// input; and the full-payment → cleared-with-QR flow.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FEE_CENTAVOS,
  api, assertLedgerEntry, expectAnyError, expectError, expectStatus, orgRow, prisma, resetData,
  schoolId, signIn, uniq,
} from './helpers.mjs';

let token;
let students; // school ID → Student
let fees; // name → FeeItem

before(async () => {
  await resetData();
  token = (await signIn('devdept', 'treasurer')).token;
  const list = expectStatus(await api('GET', '/orgs/devdept/students', { token }), 200);
  students = Object.fromEntries(list.map((s) => [s.studentId, s]));
  const feeList = expectStatus(await api('GET', '/orgs/devdept/fees'), 200);
  fees = Object.fromEntries(feeList.map((f) => [f.name, f]));
});
after(() => prisma.$disconnect());

const pay = (n, feeName, amountCentavos, orNumber = uniq('OR')) =>
  api('POST', '/orgs/devdept/payments', {
    token,
    json: { studentId: students[schoolId('devdept', n)].id, feeId: fees[feeName].id, amountCentavos, orNumber },
  });

describe('POST /orgs/:org/payments', () => {
  it('full payment → 201 LedgerEntry backed by a Collection row', async () => {
    const orNumber = uniq('OR');
    const entry = expectStatus(await pay(1, 'Membership Fee', 15000, orNumber), 201);
    assertLedgerEntry(entry);
    assert.equal(entry.kind, 'collection');
    assert.equal(entry.amountCentavos, 15000);

    const row = await prisma.collection.findUnique({ where: { id: entry.id } });
    assert.ok(row, 'LedgerEntry.id should be the Collection id');
    assert.equal(row.organizationId, (await orgRow('devdept')).id);
    assert.equal(row.orNumber, orNumber);
    assert.equal(row.amountPaid, 150);
    assert.equal(row.itemDescription, 'Membership Fee');
    assert.equal(row.fundAllocation, 'General Fund');
    assert.equal(row.balanceDue, 0);

    const ledger = expectStatus(await api('GET', '/orgs/devdept/ledger', { token }), 200);
    assert.equal(ledger[0]?.id, entry.id, 'the new payment should be the newest ledger entry');
  });

  it('paying an item that is already fully paid → 409 conflict', async () => {
    expectError(await pay(1, 'Membership Fee', 15000), 409, 'conflict');
  });

  it('partial payment is accepted and leaves a balance', async () => {
    const entry = expectStatus(await pay(2, 'Org Shirt', 10000), 201);
    const row = await prisma.collection.findUnique({ where: { id: entry.id } });
    assert.equal(row.balanceDue, 250);
  });

  it('same OR number for the same item → 409 duplicate_or, nothing recorded', async () => {
    const orNumber = uniq('OR');
    expectStatus(await pay(2, 'Org Shirt', 5000, orNumber), 201);
    const before = await prisma.collection.count();
    expectError(await pay(2, 'Org Shirt', 5000, orNumber), 409, 'duplicate_or');
    expectError(await pay(3, 'Org Shirt', 5000, orNumber), 409, 'duplicate_or');
    expectError(await pay(3, 'Org Shirt', 5000, ` ${orNumber.toLowerCase()} `), 409, 'duplicate_or');
    assert.equal(await prisma.collection.count(), before);
  });

  it('the same OR number on a different item is allowed (one receipt, several items)', async () => {
    const orNumber = uniq('OR');
    expectStatus(await pay(3, 'Membership Fee', 15000, orNumber), 201);
    expectStatus(await pay(3, 'Acquaintance Party', 20000, orNumber), 201);
  });

  it('overpaying an item → 400 invalid', async () => {
    expectError(await pay(4, 'Acquaintance Party', FEE_CENTAVOS['Acquaintance Party'] + 1), 400, 'invalid');
    // Remaining balance of student 2's shirt is 20000 after 15000 paid above.
    expectError(await pay(2, 'Org Shirt', 20001), 400, 'invalid');
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
    const res = await api('POST', '/orgs/devdept/payments', {
      token,
      json: { studentId: '00000000-0000-0000-0000-000000000000', feeId: fees['Membership Fee'].id, amountCentavos: 15000, orNumber: uniq('OR') },
    });
    expectError(res, 422, 'invalid_student');
  });

  it('unknown fee → 400/404', async () => {
    const res = await api('POST', '/orgs/devdept/payments', {
      token,
      json: { studentId: students[schoolId('devdept', 4)].id, feeId: 'no-such-fee', amountCentavos: 15000, orNumber: uniq('OR') },
    });
    expectAnyError(res, [400, 404]);
  });

  it('no token → 401 unauthorized', async () => {
    const res = await api('POST', '/orgs/devdept/payments', {
      json: { studentId: students[schoolId('devdept', 4)].id, feeId: fees['Membership Fee'].id, amountCentavos: 15000, orNumber: uniq('OR') },
    });
    expectError(res, 401, 'unauthorized');
  });
});

describe('paying the whole package clears the student', () => {
  it('public clearance → cleared with an absolute, signed verification URL as qrToken', async () => {
    for (const name of Object.keys(FEE_CENTAVOS)) expectStatus(await pay(5, name, FEE_CENTAVOS[name]), 201);

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
