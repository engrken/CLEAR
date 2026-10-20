import test from 'node:test';
import assert from 'node:assert/strict';
import { selectConfiguredRemittanceFee, REMITTANCE_PACKAGE_LABEL } from '../lib/remittance-fee-policy.ts';

const setups = [
  { category: 'Membership', name: 'Membership Fee', amount: 150, targetFund: 'Membership Fund', isPackage: false },
  { category: 'Departmental Fee', name: 'COE FCUSR Activities', amount: 100, targetFund: 'FCUSR Activities Fund', isPackage: true },
  { category: 'Departmental Fee', name: 'Orientation', amount: 200, targetFund: 'General Orientation Fund', isPackage: true },
  { category: 'Merchandise', name: 'Departmental Shirt', amount: 450, targetFund: 'Merchandise Fund', isPackage: true },
];

test('only a configured Fee Setup item can be accepted', () => {
  assert.throws(
    () => selectConfiguredRemittanceFee(setups, { itemDescription: 'Invented Donation', category: 'Membership' }),
    /not configured in Fee Setup/i,
  );
});

test('explicit selected category must match configured fee', () => {
  assert.throws(
    () => selectConfiguredRemittanceFee(setups, { itemDescription: 'Membership Fee', category: 'Merchandise' }),
    /category does not match/i,
  );
  const selected = selectConfiguredRemittanceFee(setups, { itemDescription: 'Membership Fee', category: 'Membership' });
  assert.equal(selected.kind, 'single');
  assert.equal(selected.category, 'Membership');
});

test('legacy generic category may only resolve an unambiguous configured single fee', () => {
  const selected = selectConfiguredRemittanceFee(setups, { itemDescription: 'Membership Fee', category: 'Online Remittance' });
  assert.equal(selected.kind, 'single');
  assert.equal(selected.category, 'Membership');
  assert.throws(
    () => selectConfiguredRemittanceFee(
      [...setups, { ...setups[0], category: 'Other' }],
      { itemDescription: 'Membership Fee', category: 'Online Remittance' },
    ),
    /ambiguous|duplicate/i,
  );
});

test('package uses only the selected category and never unrelated packages', () => {
  const selected = selectConfiguredRemittanceFee(setups, {
    itemDescription: REMITTANCE_PACKAGE_LABEL, category: 'Departmental Fee',
  });
  assert.equal(selected.kind, 'package');
  assert.equal(selected.category, 'Departmental Fee');
  assert.deepEqual(selected.items.map(x => x.name), ['COE FCUSR Activities', 'Orientation']);
  assert.equal(selected.items.reduce((sum,x) => sum + x.amount,0), 300);
  assert.ok(!selected.items.some(x => x.category === 'Merchandise'));
});

test('package cannot infer a category from a legacy generic remittance', () => {
  assert.throws(
    () => selectConfiguredRemittanceFee(setups, {
      itemDescription: REMITTANCE_PACKAGE_LABEL, category: 'Online Remittance',
    }),
    /explicitly selected fee category/i,
  );
});

test('reject duplicate names inside or across package categories to protect legacy credits', () => {
  assert.throws(
    () => selectConfiguredRemittanceFee(
      [...setups, { ...setups[1], category: 'Other' }],
      { itemDescription: REMITTANCE_PACKAGE_LABEL, category: 'Departmental Fee' },
    ),
    /Ambiguous package/i,
  );
});

test('no configured category means no package payment', () => {
  assert.throws(
    () => selectConfiguredRemittanceFee(setups, {
      itemDescription: REMITTANCE_PACKAGE_LABEL, category: 'Unknown',
    }),
    /No package Fee Setup/i,
  );
});
