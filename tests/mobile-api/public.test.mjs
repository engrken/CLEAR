// Public endpoints (no token): orgs, fees, clearance lookup, proof upload.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AY, FEE_CENTAVOS, PACKAGE_CENTAVOS, TERM,
  api, assertCentavos, assertOrganization, expectAnyError, expectError, expectStatus,
  orgRow, prisma, proofForm, resetData, schoolId, signIn,
} from './helpers.mjs';

before(resetData);
after(() => prisma.$disconnect());

describe('GET /orgs', () => {
  it('lists both dev orgs in the Organization shape', async () => {
    const orgs = expectStatus(await api('GET', '/orgs'), 200);
    assert.ok(Array.isArray(orgs));
    for (const o of orgs) assertOrganization(o);
    const dev = orgs.find((o) => o.subdomain === 'devdept');
    assert.ok(dev, 'devdept missing');
    assert.ok(orgs.some((o) => o.subdomain === 'otherdept'), 'otherdept missing');
    assert.equal(dev.name, 'Dev Department of Engineering');
    assert.equal(dev.type, 'Department');
    assert.equal(dev.activeAy, AY);
    assert.equal(dev.activeTerm, TERM);
  });

  it('GET /orgs/:org returns one org', async () => {
    const org = expectStatus(await api('GET', '/orgs/devdept'), 200);
    assertOrganization(org);
    assert.equal(org.subdomain, 'devdept');
  });

  it('GET /orgs/:org for an unknown org → 404 not_found', async () => {
    expectError(await api('GET', '/orgs/no-such-dept-xyz'), 404, 'not_found');
  });
});

describe('GET /orgs/:org/fees', () => {
  it('returns the active-term fee items with integer centavos', async () => {
    const fees = expectStatus(await api('GET', '/orgs/devdept/fees'), 200);
    assert.ok(Array.isArray(fees));
    assert.equal(fees.length, 3);
    for (const f of fees) {
      assert.equal(typeof f.id, 'string');
      assert.equal(typeof f.category, 'string');
      assert.equal(typeof f.targetFund, 'string');
      assertCentavos(f.amountCentavos, `${f.name}.amountCentavos`);
      assert.equal(f.amountCentavos, FEE_CENTAVOS[f.name], `amount of ${f.name}`);
    }
  });

  it('fee ids are per org (no overlap with otherdept)', async () => {
    const dev = expectStatus(await api('GET', '/orgs/devdept/fees'), 200).map((f) => f.id);
    const other = expectStatus(await api('GET', '/orgs/otherdept/fees'), 200).map((f) => f.id);
    assert.equal(dev.filter((id) => other.includes(id)).length, 0);
  });

  it('unknown org → 404 not_found', async () => {
    expectError(await api('GET', '/orgs/no-such-dept-xyz/fees'), 404, 'not_found');
  });
});

describe('GET /orgs/:org/clearance', () => {
  const q = (org, value) => `/orgs/${org}/clearance?q=${encodeURIComponent(value)}`;

  it('finds a student by school ID; public view hides the amount', async () => {
    const r = expectStatus(await api('GET', q('devdept', schoolId('devdept', 1))), 200);
    assert.equal(r.studentName, 'Ana Reyes');
    assert.equal(r.studentId, schoolId('devdept', 1));
    assert.equal(r.status, 'hold', 'nobody has paid yet, so the student is on hold');
    assert.equal(r.outstandingCentavos, null, 'public lookups must not reveal the outstanding amount (F54)');
    assert.equal(r.qrToken, null, 'no QR for a student on hold');
    assert.equal(r.ay, AY);
    assert.equal(r.term, TERM);
  });

  it('finds a student by email', async () => {
    const r = expectStatus(await api('GET', q('devdept', 'dev-2026-0002@students.local')), 200);
    assert.equal(r.studentName, 'Ben Santos');
    assert.equal(r.outstandingCentavos, null);
  });

  it('unknown student → 404 not_found', async () => {
    expectError(await api('GET', q('devdept', 'DEV-9999-0000')), 404, 'not_found');
  });

  it("another org's student is not found (tenant isolation)", async () => {
    expectError(await api('GET', q('devdept', schoolId('otherdept', 1))), 404, 'not_found');
    expectError(await api('GET', q('devdept', 'oth-2026-0001@students.local')), 404, 'not_found');
  });

  it('missing q → 400 or 404 error', async () => {
    expectAnyError(await api('GET', '/orgs/devdept/clearance'), [400, 404]);
  });

  it('officer token with tab-clearance for this org reveals the amount', async () => {
    const { token } = await signIn('devdept', 'viewer'); // viewer has tab-clearance
    const r = expectStatus(await api('GET', q('devdept', schoolId('devdept', 1)), { token }), 200);
    assertCentavos(r.outstandingCentavos, 'outstandingCentavos');
    assert.equal(r.outstandingCentavos, PACKAGE_CENTAVOS);
  });

  it("another org's officer token does not reveal the amount", async () => {
    const { token } = await signIn('otherdept', 'admin');
    const r = expectStatus(await api('GET', q('devdept', schoolId('devdept', 1)), { token }), 200);
    assert.equal(r.outstandingCentavos, null);
  });

  it('an invalid token is treated as public', async () => {
    const r = expectStatus(await api('GET', q('devdept', schoolId('devdept', 1)), { token: 'clr_' + 'x'.repeat(43) }), 200);
    assert.equal(r.outstandingCentavos, null);
  });
});

describe('POST /orgs/:org/proofs', () => {
  it('accepts a PNG proof → 201 { submissionId }, queued with the roster name', async () => {
    const referenceNumber = 'GC-' + Date.now();
    const res = await api('POST', '/orgs/devdept/proofs', {
      form: proofForm({ studentId: schoolId('devdept', 1), amountCentavos: 15000, referenceNumber }),
    });
    const { submissionId } = expectStatus(res, 201);
    assert.equal(typeof submissionId, 'string');

    const row = await prisma.onlineRemittance.findUnique({ where: { submissionId } });
    assert.ok(row, 'remittance row not created');
    assert.equal(row.organizationId, (await orgRow('devdept')).id);
    assert.equal(row.studentName, 'Ana Reyes', 'student name comes from the roster');
    assert.equal(row.referenceNumber, referenceNumber);
    assert.equal(row.amountPaid, 150);
    assert.equal(row.status, 'Pending Verification');
    assert.match(row.proofUrl || '', /^data:image\/png;base64,/);
  });

  it('wrong file type (text/plain) → 400 invalid', async () => {
    const file = { blob: new Blob(['not an image'], { type: 'text/plain' }), name: 'proof.txt' };
    const res = await api('POST', '/orgs/devdept/proofs', { form: proofForm({ studentId: schoolId('devdept', 1), file }) });
    expectError(res, 400, 'invalid');
  });

  it('PDF → 400 invalid', async () => {
    const file = { blob: new Blob(['%PDF-1.4\n'], { type: 'application/pdf' }), name: 'proof.pdf' };
    const res = await api('POST', '/orgs/devdept/proofs', { form: proofForm({ studentId: schoolId('devdept', 1), file }) });
    expectError(res, 400, 'invalid');
  });

  it('image over 4 MB → 413 payload_too_large', async () => {
    const big = new Uint8Array(4 * 1024 * 1024 + 1024);
    big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const file = { blob: new Blob([big], { type: 'image/png' }), name: 'big.png' };
    const res = await api('POST', '/orgs/devdept/proofs', { form: proofForm({ studentId: schoolId('devdept', 1), file }) });
    expectError(res, 413, 'payload_too_large');
  });

  it('unknown student → 422 invalid_student', async () => {
    const res = await api('POST', '/orgs/devdept/proofs', { form: proofForm({ studentId: 'DEV-9999-0000' }) });
    expectError(res, 422, 'invalid_student');
  });

  it("another org's student → 422 invalid_student", async () => {
    const res = await api('POST', '/orgs/devdept/proofs', { form: proofForm({ studentId: schoolId('otherdept', 1) }) });
    expectError(res, 422, 'invalid_student');
  });

  it('non-integer / zero amount → 400 invalid', async () => {
    for (const amountCentavos of ['abc', '0', '150.5', '-100']) {
      const res = await api('POST', '/orgs/devdept/proofs', { form: proofForm({ studentId: schoolId('devdept', 1), amountCentavos }) });
      expectError(res, 400, 'invalid');
    }
  });

  it('missing reference number → 400 invalid', async () => {
    const res = await api('POST', '/orgs/devdept/proofs', { form: proofForm({ studentId: schoolId('devdept', 1), referenceNumber: '' }) });
    expectError(res, 400, 'invalid');
  });

  it('unknown org → 404 not_found', async () => {
    const res = await api('POST', '/orgs/no-such-dept-xyz/proofs', { form: proofForm({ studentId: schoolId('devdept', 1) }) });
    expectError(res, 404, 'not_found');
  });

  it('payment channel outside GCash/Maya/Bank transfer → 400 invalid', async () => {
    const res = await api('POST', '/orgs/devdept/proofs', { form: proofForm({ studentId: schoolId('devdept', 1), paymentChannel: 'Bitcoin' }) });
    expectError(res, 400, 'invalid');
  });

  it('missing proof file → 400 invalid', async () => {
    const res = await api('POST', '/orgs/devdept/proofs', { form: proofForm({ studentId: schoolId('devdept', 1), file: null }) });
    expectError(res, 400, 'invalid');
  });
});
