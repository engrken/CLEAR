import test from 'node:test';
import assert from 'node:assert/strict';
import { choosePendingPayment, parsePaymentCentavos, parsePendingPayment } from '../mobile/src/lib/payment-pending.ts';
import { readFileSync } from 'node:fs';

const id1 = 'e61cd129-452c-45b5-b944-8330bfa708a3';
const id2 = 'b673a7a1-5db6-4a3a-97ea-32b7fe9a1f12';
const draft = { studentId: 'student-a', feeId: 'fee-a', amountCentavos: 22167 };

test('peso amount parser preserves exact centavos without float rounding', () => {
  for (const [input, value] of [['221.67', 22167], ['0.01', 1], ['1', 100],
    ['1,000.50', 100050], ['1000000.00', 100000000], ['1,000,000', 100000000]]) {
    assert.equal(parsePaymentCentavos(input), value, input);
  }
  for (const input of ['0', '-1', '0.001', '10.999', '1.234', '01.00', '1,2', '1,,000', 
    '1 000', 'NaN', 'Infinity', '1000000.01', '9999999999', '1e3', '']) {
    assert.equal(parsePaymentCentavos(input), null, input);
  }
});

test('a dropped response reuses the original immutable request key', () => {
  const first = choosePendingPayment(null, draft, () => id1);
  const restored = parsePendingPayment(JSON.stringify(first));
  assert.deepEqual(restored, first);
  let generated = 0;
  const retry = choosePendingPayment(restored, { ...draft }, () => { generated += 1; return id2; });
  assert.deepEqual(retry, first);
  assert.equal(generated, 0);
  for (const different of [{ ...draft, amountCentavos: 22168 }, { ...draft, feeId: 'fee-b' },
    { ...draft, studentId: 'student-b' }]) {
    assert.throws(() => choosePendingPayment(restored, different, () => id2), /awaiting confirmation/);
  }
});

test('old fingerprint-based drafts are recovered without replacing their UUID', () => {
  const old = JSON.stringify({ fingerprint: JSON.stringify(draft), key: id1 });
  assert.deepEqual(parsePendingPayment(old), { version: 1, key: id1, draft });
});

test('malformed or unusable secure-store recovery fails closed', () => {
  assert.equal(parsePendingPayment(null), null);
  for (const bad of ['', '{bad}', '{}', JSON.stringify({ key: 'not-uuid', draft, version: 1 }),
    JSON.stringify({ key: id1, draft: { ...draft, amountCentavos: 1.25 }, version: 1 })]) {
    assert.throws(() => parsePendingPayment(bad), /recovery is unreadable/);
  }
  assert.throws(() => choosePendingPayment(null, draft, () => 'weak-key'), /Secure payment request ID unavailable/);
});

test('native cashier cannot overwrite unresolved payment while retrying another draft', () => {
  const screen = readFileSync(new URL('../mobile/src/app/(officer)/collect.tsx', import.meta.url), 'utf8');
  assert.match(screen, /parsePendingPayment\(await SecureStore\.getItemAsync\(pendingKey\)\)/);
  assert.match(screen, /choosePendingPayment\(existing, draft,/);
  assert.match(screen, /SecureStore\.setItemAsync\(pendingKey, JSON\.stringify\(attempt\)\)/);
  assert.match(screen, /Retry exact payment/);
  assert.match(screen, /disabled=\{!recoveryReady \|\| !!pending \|\| !!recoveryIssue\}/);
  assert.match(screen, /PAYMENT_WRITES_ENABLED/);
});
