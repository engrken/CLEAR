import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('both posting paths allocate receipts on the server', () => {
  for (const path of ['app/department/[department]/(protected)/collections/actions.ts', 'app/department/[department]/(protected)/remittances/actions.ts']) {
    const source = read(path);
    assert.ok(source.includes('await allocateOfficialReceiptNumber(tx, org.id)'), path);
  }
});

test('collection schema retains package-compatible receipt uniqueness', () => {
  const model = read('prisma/schema.prisma').split('model Collection {')[1].split('model CollectionSetup')[0];
  assert.ok(model.includes('@@unique([organizationId, orNumber, itemDescription])'));
  assert.ok(!model.includes('@@unique([organizationId, orNumber])'));
});

test('financial posting uses Serializable transactions and bounded retries', () => {
  const source = read('lib/financial-transaction.ts');
  assert.ok(source.includes('TransactionIsolationLevel.Serializable'));
  assert.ok(source.includes('P2034'));
  assert.ok(source.includes('maxAttempts'));
});

test('receipt allocator uses the database sequence and duplicate check', () => {
  const source = read('lib/receipt-number.ts');
  assert.ok(source.includes("nextval('clear_receipt_sequence'::regclass)"));
  assert.ok(source.includes('receiptNumberConflictWhere(organizationId, orNumber)'));
  assert.ok(source.includes('lockReceiptNumber(tx, organizationId, orNumber)'));
});

test('receipt form uses server-issued OR number', () => {
  const form = read('app/department/[department]/(protected)/collections/CollectionsForm.tsx');
  assert.ok(form.includes('orNumber: result.orNumber'));
  assert.ok(!form.includes('setOrNumber'));
});

test('online remittance approval is atomic and rejects a second reviewer', () => {
  const source = read('app/department/[department]/(protected)/remittances/actions.ts');
  assert.ok(source.includes('await withFinancialTransaction(async (tx) => {'));
  assert.ok(source.includes('await tx.onlineRemittance.updateMany('));
  assert.ok(source.includes('if (updated.count !== 1)'));
  assert.ok(source.includes('await tx.collection.create('));
});

test('collection posting keeps ledger and receipt writes in the same transaction', () => {
  const source = read('app/department/[department]/(protected)/collections/actions.ts');
  assert.ok(source.includes('withFinancialTransaction(async (tx) => {'));
  assert.ok(source.includes('await tx.collection.create('));
  assert.ok(source.includes('await enqueuePaymentReceipt(tx,'));
});
