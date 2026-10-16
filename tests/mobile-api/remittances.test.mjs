// Online remittances: detail (with proof image), verify (needs an OR number,
// once only), invalidate, and how they show up in the ledger.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  api, assertLedgerEntry, expectError, expectStatus, prisma, resetData, schoolId, signIn, submitProof, uniq,
} from './helpers.mjs';

let token;
let r1; // Ana, Membership Fee → verified
let r2; // Ben, Org Shirt → invalidated
let r3; // Carla, Membership Fee → duplicate OR, then verified with an explicit fund
const verifiedOr = uniq('OR');

before(async () => {
  await resetData();
  token = (await signIn('devdept', 'treasurer')).token;
  r1 = await submitProof('devdept', { studentId: schoolId('devdept', 1), amountCentavos: 15000, itemDescription: 'Membership Fee' });
  r2 = await submitProof('devdept', { studentId: schoolId('devdept', 2), amountCentavos: 35000, itemDescription: 'Org Shirt', paymentChannel: 'Maya' });
  r3 = await submitProof('devdept', { studentId: schoolId('devdept', 3), amountCentavos: 15000, itemDescription: 'Membership Fee', paymentChannel: 'Bank transfer' });
});
after(() => prisma.$disconnect());

const detail = (id) => api('GET', `/orgs/devdept/remittances/${id}`, { token });
const verify = (id, body) => api('POST', `/orgs/devdept/remittances/${id}/verify`, { token, json: body });
const invalidate = (id) => api('POST', `/orgs/devdept/remittances/${id}/invalidate`, { token });

describe('ledger and detail', () => {
  it("a submitted proof appears in the ledger as 'online-remittance' with the remittance id", async () => {
    const ledger = expectStatus(await api('GET', '/orgs/devdept/ledger', { token }), 200);
    const e = ledger.find((x) => x.id === r1.id);
    assert.ok(e, 'remittance missing from ledger (LedgerEntry.id should be the OnlineRemittance id)');
    assertLedgerEntry(e);
    assert.equal(e.kind, 'online-remittance');
    assert.equal(e.amountCentavos, 15000);
  });

  it('GET /remittances/:id → RemittanceDetail with the proof as a data URL', async () => {
    const d = expectStatus(await detail(r1.id), 200);
    assertLedgerEntry(d);
    assert.equal(d.id, r1.id);
    assert.equal(d.kind, 'online-remittance');
    assert.equal(d.amountCentavos, 15000);
    assert.equal(d.studentId, schoolId('devdept', 1));
    assert.equal(d.studentEmail, 'dev-2026-0001@students.local');
    assert.equal(d.paymentChannel, 'GCash');
    assert.equal(d.itemDescription, 'Membership Fee');
    assert.match(d.proofDataUrl, /^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
    assert.equal(d.reviewNotes, null);
    assert.equal(d.reviewedBy, null);
  });

  it('unknown id → 404 not_found', async () => {
    expectError(await detail('00000000-0000-0000-0000-000000000000'), 404, 'not_found');
  });
});

describe('POST /remittances/:id/verify', () => {
  it('without an OR number → 400 invalid, still pending', async () => {
    expectError(await verify(r1.id, {}), 400, 'invalid');
    expectError(await verify(r1.id, { orNumber: '  ' }), 400, 'invalid');
    const row = await prisma.onlineRemittance.findUnique({ where: { id: r1.id } });
    assert.equal(row.status, 'Pending Verification');
  });

  it('with an OR number → 200 { orNumber }, records a collection in the default fund', async () => {
    const r = expectStatus(await verify(r1.id, { orNumber: verifiedOr }), 200);
    assert.deepEqual(r, { orNumber: verifiedOr });

    const row = await prisma.onlineRemittance.findUnique({ where: { id: r1.id } });
    assert.equal(row.status, 'Verified');
    assert.equal(row.orNumber, verifiedOr);
    assert.ok(row.reviewedBy, 'reviewedBy should be set');

    const col = await prisma.collection.findFirst({ where: { organizationId: row.organizationId, orNumber: verifiedOr } });
    assert.ok(col, 'verifying should record a collection');
    assert.equal(col.amountPaid, 150);
    assert.equal(col.fundAllocation, 'General Fund', "defaults to the fee item's target fund");

    const d = expectStatus(await detail(r1.id), 200);
    assert.equal(typeof d.reviewedBy, 'string');
  });

  it('verifying twice → 409 conflict, no second collection', async () => {
    const before = await prisma.collection.count();
    expectError(await verify(r1.id, { orNumber: uniq('OR') }), 409, 'conflict');
    assert.equal(await prisma.collection.count(), before);
  });

  it('OR number already used for the same item → 409 duplicate_or, still pending', async () => {
    expectError(await verify(r3.id, { orNumber: verifiedOr }), 409, 'duplicate_or');
    const row = await prisma.onlineRemittance.findUnique({ where: { id: r3.id } });
    assert.equal(row.status, 'Pending Verification', 'a failed verify must not change the status');
  });

  it('fundAllocation overrides the default fund', async () => {
    const orNumber = uniq('OR');
    expectStatus(await verify(r3.id, { orNumber, fundAllocation: 'Activity Fund' }), 200);
    const col = await prisma.collection.findFirst({ where: { orNumber } });
    assert.equal(col.fundAllocation, 'Activity Fund');
  });

  it('unknown id → 404 not_found', async () => {
    expectError(await verify('00000000-0000-0000-0000-000000000000', { orNumber: uniq('OR') }), 404, 'not_found');
  });
});

describe('POST /remittances/:id/invalidate', () => {
  it('pending remittance → 200 { ok: true }, marked reviewed', async () => {
    assert.deepEqual(expectStatus(await invalidate(r2.id), 200), { ok: true });
    const row = await prisma.onlineRemittance.findUnique({ where: { id: r2.id } });
    assert.notEqual(row.status, 'Pending Verification');
    assert.notEqual(row.status, 'Verified');
    const d = expectStatus(await detail(r2.id), 200);
    assert.equal(typeof d.reviewedBy, 'string');
    assert.equal(typeof d.reviewNotes, 'string');
  });

  it('a verified remittance cannot be invalidated → 409 conflict', async () => {
    expectError(await invalidate(r1.id), 409, 'conflict');
    const row = await prisma.onlineRemittance.findUnique({ where: { id: r1.id } });
    assert.equal(row.status, 'Verified');
  });

  it('unknown id → 404 not_found', async () => {
    expectError(await invalidate('00000000-0000-0000-0000-000000000000'), 404, 'not_found');
  });

  it('an invalidated remittance cannot be verified afterwards → 409 conflict', async () => {
    const before = await prisma.collection.count();
    expectError(await verify(r2.id, { orNumber: uniq('OR') }), 409, 'conflict');
    assert.equal(await prisma.collection.count(), before);
  });
});
