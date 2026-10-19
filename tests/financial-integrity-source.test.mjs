import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('both posting paths lock receipt number before duplicate check', () => {
  for (const path of ['app/department/[department]/(protected)/collections/actions.ts', 'app/department/[department]/(protected)/remittances/actions.ts']) {
    const source = read(path);
    const lock = source.indexOf('await lockReceiptNumber(tx, org.id, orNumber)');
    const duplicate = source.indexOf('const conflict', lock);
    assert.ok(lock >= 0 && duplicate > lock, path);
  }
});

test('collection schema retains package-compatible receipt uniqueness', () => {
  const model = read('prisma/schema.prisma').split('model Collection {')[1].split('model CollectionSetup')[0];
  assert.ok(model.includes('@@unique([organizationId, orNumber, itemDescription])'));
  assert.ok(!model.includes('@@unique([organizationId, orNumber])'));
});
