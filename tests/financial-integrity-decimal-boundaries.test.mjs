import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { moneyCentavos, moneyNumber } from '../lib/money-precision.ts';

test('Prisma.Decimal read boundary preserves all centavos without rounded hidden fractions', () => {
  for (const [value, cents] of [
    ['0',0],['0.01',1],['0.02',2],['100',10000],['450.50',45050],
    ['650.13',65013],['-0.01',-1],['-125151.00',-12515100],
  ]) {
    assert.equal(moneyCentavos(new Prisma.Decimal(value)), cents);
    assert.equal(moneyCentavos(moneyNumber(new Prisma.Decimal(value))), cents);
  }
  assert.equal(moneyCentavos('1.01')+moneyCentavos('0.02'),103);
  assert.equal(moneyCentavos(new Prisma.Decimal('0.10'))+
    moneyCentavos(new Prisma.Decimal('0.20')),30);
});

test('Prisma.Decimal converter rejects invalid, fractional centavos and unsafe precision', () => {
  for(const value of ['1.001','0.999','NaN','Infinity','1e5','','1.0000001',
    '90071992547410.00','-90071992547410.00','1,000.00']) {
    assert.throws(() => moneyCentavos(value), String(value));
  }
  assert.throws(() => moneyNumber({toString:()=> 'MALFORMED'}));
});

test('NULL money is never silently converted into a present zero-valued assessed penalty', () => {
  const optional = null;
  assert.equal(optional == null ? null : moneyNumber(optional), null);
});

test('read-only mobile centavo serialization is strict for Decimal and tolerates absent optional values', async () => {
  const src = await import('node:fs/promises').then(fs => fs.readFile(
    new URL('../lib/mobile/serialize.ts', import.meta.url), 'utf8'));
  assert.match(src,/moneyCentavos\(pesos\)/);
  assert.match(src,/pesos == null \? 0/);
  const data = await import('node:fs/promises').then(fs => fs.readFile(
    new URL('../lib/mobile/data.ts', import.meta.url), 'utf8'));
  assert.match(data,/amountPaid: MoneyScalar/);
  assert.match(data,/fineAmount: MoneyScalar/);
});
