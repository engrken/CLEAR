import test from 'node:test';
import assert from 'node:assert/strict';
import { canPageDefaultReceiptHistory } from '../lib/receipts/receipt-history-paging.ts';

const baseline = {
  ay: 'A.Y. 2026 - 2027', term: '1st Sem',
  q: '', exactOr: '', status: 'all', category: '',
  description: '', paymentType: '', from: '', to: '',
  inconsistentOnly: false,
};

test('default current-period full receipt groups can use read-only SQL paging', () => {
  assert.equal(canPageDefaultReceiptHistory(baseline), true);
});

test('never paginate a query spanning academic periods or empty selectors', () => {
  for (const field of ['ay', 'term']) {
    assert.equal(canPageDefaultReceiptHistory({ ...baseline, [field]: '' }), false);
  }
});

test('keep exact OR, text, status, allocation filters and anomaly audit in legacy path', () => {
  const cases = [
    { q: 'student' }, { exactOr: 'OR-123' }, { status: 'voided' },
    { status: 'inconsistent' }, { category: 'fees' },
    { description: 'laboratory' }, { paymentType: 'cash' },
    { from: '2026-11-01' }, { to: '2026-11-03' },
    { inconsistentOnly: true },
  ];
  for (const filter of cases) {
    assert.equal(canPageDefaultReceiptHistory({ ...baseline, ...filter }), false,
      JSON.stringify(filter));
  }
});

test('non-default unknown status must not enable fast path', () => {
  assert.equal(canPageDefaultReceiptHistory({ ...baseline, status: 'unknown' }), false);
});
