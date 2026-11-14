import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const landing = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const demo = readFileSync(new URL('../app/demo/page.tsx', import.meta.url), 'utf8');
const bypass = readFileSync(new URL('../lib/demo-reviewer.ts', import.meta.url), 'utf8');

test('landing page links visitors to the isolated demo', () => {
  assert.match(landing, /id="try-demo"/);
  assert.match(landing, /href="\/demo"/);
});
test('public demo uses hardcoded fictional records and no session escalation', () => {
  assert.match(demo, /PUBLIC SANDBOX/);
  assert.match(demo, /FICTIONAL DATA/);
  assert.match(demo, /DEMO-001/);
  assert.doesNotMatch(demo, /signIn\(|prisma\.|fetch\(|server action|use server|password|secret|token/i);
});
test('existing demo-reviewer authorization bypass stays disabled', () => {
  assert.match(bypass, /isDemoReviewerEnabled\(\): boolean \{ return false; \}/);
  assert.match(bypass, /demoReviewerCode\([^\n]+\): string \| null \{ return null; \}/);
});
