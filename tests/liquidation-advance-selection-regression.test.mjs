// Prevent reintroduction of the Prisma Decimal -> React number crash on CA selection.
// Source regression only; Next.js production build and isolated finance integration run separately.
// No live production database access.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../app/department/[department]/(protected)/liquidations/page.tsx', import.meta.url), 'utf8');
const form = readFileSync(new URL('../app/department/[department]/(protected)/liquidations/LiquidationsForm.tsx', import.meta.url), 'utf8');

test('liquidation page converts Prisma Decimal cash advance amounts before sending client props', () => {
  assert.match(page, /amountApproved:\s*Number\(advance\.amountApproved\)/,
    'approved amount must be a number at the server/component boundary');
  assert.match(page, /pendingAdvances\s*=\s*allAdvances\.filter\([\s\S]+?\)\.map\(advance\s*=>\s*\(\{/,
    'pending cash advance options must map database records to a small client DTO');
});

test('cash advance selection preserves numeric budget state for toFixed and variance', () => {
  assert.match(form, /const approved = Number\(match\.amountApproved\)/,
    'normalize numeric input even if a legacy serializer supplies a string');
  assert.match(form, /setBudgetRequested\(Number\.isFinite\(approved\)\s*\?\s*approved\s*:\s*0\)/,
    'never render unnormalized money with toFixed');
  assert.doesNotMatch(form, /setBudgetRequested\(match\.amountApproved\)/,
    'directly storing Prisma Decimal breaks toFixed');
  assert.match(form, /budgetRequested\.toFixed\(2\)/);
});

test('representative approved budget values remain centavo-accurate in display state', () => {
  for (const raw of ['3000.00', '500.00', '221.67']) {
    const budgetRequested = Number(raw);
    assert.ok(Number.isFinite(budgetRequested));
    assert.equal(budgetRequested.toFixed(2), raw);
  }
});
