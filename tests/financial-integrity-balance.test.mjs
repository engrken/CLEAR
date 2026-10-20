import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  summarizeValidCollectionCredits, calculateCollectionBalancePreview, PACKAGE_NAME,
} from '../lib/collection-payment-preview.mjs';

const fee = (credits, opts = {}) => calculateCollectionBalancePreview({
  credits, itemDescription: 'Membership Fee', standardRate: 150, ...opts,
});

test('voided receipts never count toward credited amounts', () => {
  const credits = summarizeValidCollectionCredits([
    { itemDescription: 'Membership Fee', amountPaid: 50, status: 'Valid', paymentType: 'Partial Payment' },
    { itemDescription: 'Membership Fee', amountPaid: 50, status: 'VOID', paymentType: 'Partial Payment' },
    { itemDescription: 'Membership Fee', amountPaid: 30, status: 'Cancelled', paymentType: 'Partial Payment' },
    { itemDescription: 'Membership Fee', amountPaid: 20, status: 'Valid', paymentType: 'Voided Payment' },
  ]);
  assert.deepEqual(credits, [{ itemDescription: 'membership fee', paidCents: 5000 }]);
  assert.deepEqual(fee(credits), { dueCents: 10000, alreadyPaidCents: 5000, payableCents: 10000 });
});

test('full, partial and fully paid fee preview respects prior receipts', () => {
  assert.deepEqual(fee([]), { dueCents: 15000, alreadyPaidCents: 0, payableCents: 15000 });
  assert.equal(fee([{ itemDescription: 'Membership Fee', paidCents: 10000 }]).dueCents, 5000);
  assert.equal(fee([{ itemDescription: 'membership fee', paidCents: 15000 }]).payableCents, 0);
});

test('package credits include split receipts and legacy single-line packages', () => {
  const preview = calculateCollectionBalancePreview({
    itemDescription: PACKAGE_NAME, standardRate: 500,
    packageItems: [{ name: 'Membership Fee', amount: 150 }, { name: 'Org Shirt', amount: 350 }],
    credits: [
      { itemDescription: 'membership fee', paidCents: 5000 },
      { itemDescription: PACKAGE_NAME, paidCents: 10000 },
    ],
  });
  assert.deepEqual(preview, { dueCents: 35000, alreadyPaidCents: 15000, payableCents: 35000 });
});

test('prefilled collectible cap preserves total outstanding', () => {
  assert.deepEqual(fee([{ itemDescription: 'Membership Fee', paidCents: 5000 }], { prefillLimit: 25 }),
    { dueCents: 10000, alreadyPaidCents: 5000, payableCents: 2500 });
});

test('penalty outstanding comes from its remaining fine', () => {
  assert.deepEqual(fee([{ itemDescription: 'Membership Fee', paidCents: 20000 }],
    { isPenalty: true, penaltyBalance: 35 }),
    { dueCents: 3500, alreadyPaidCents: 0, payableCents: 3500 });
});

test('cashier must have an authorized, scoped balance lookup before submitting', () => {
  const action = readFileSync(new URL('../app/department/[department]/(protected)/collections/actions.ts', import.meta.url), 'utf8');
  const form = readFileSync(new URL('../app/department/[department]/(protected)/collections/CollectionsForm.tsx', import.meta.url), 'utf8');
  assert.ok(action.includes('export async function getStudentPaymentCredits('));
  assert.ok(action.includes('await requireTabAccess("tab-payment", slug)'));
  assert.ok(action.includes('organizationId: org.id, academicYear: ay, term, studentId: student.id'));
  assert.ok(form.includes('!balanceReady || !balancePreview'));
  assert.ok(form.includes('balancePreview.payableCents'));
  assert.ok(form.includes('getStudentPaymentCredits(department, { studentId, ay, term })'));
});
