import test from 'node:test';
import assert from 'node:assert/strict';
import { strongestScheduledWindow, combinePolicyWithScheduled, effectivePolicy } from '../lib/maintenance/rules.ts';

const now = new Date('2026-10-30T08:00:00.000Z');
const window = (scopeKey, mode, startOffset, endOffset) => ({
  scopeKey, mode, title: 'Safe scheduled maintenance',
  startsAt: new Date(now.getTime() + startOffset),
  endsAt: new Date(now.getTime() + endOffset), updatedAt: now,
});
test('window activates exactly at start and expires exactly at end (server clock)', () => {
  const w = window('GLOBAL', 'FULL', 60_000, 180_000);
  assert.equal(strongestScheduledWindow([w], 'GLOBAL', now), null);
  assert.equal(strongestScheduledWindow([w], 'GLOBAL', new Date(now.getTime()+60_000))?.mode, 'FULL');
  assert.equal(strongestScheduledWindow([w], 'GLOBAL', new Date(now.getTime()+180_000)), null);
});
test('tenant window cannot affect a foreign tenant; global remains authoritative', () => {
  const a = window('tenant:jiecep', 'READ_ONLY', -60_000, 60_000);
  const g = window('GLOBAL', 'FULL', -60_000, 60_000);
  assert.equal(strongestScheduledWindow([a], 'tenant:other', now), null);
  assert.equal(effectivePolicy(strongestScheduledWindow([g], 'GLOBAL', now),
    strongestScheduledWindow([a], 'tenant:jiecep', now), now).mode, 'FULL');
});
test('overlap is fail-closed; manual and scheduled restrictions use strictest mode within scope', () => {
  const a = window('GLOBAL', 'READ_ONLY', -60_000, 60_000);
  const b = window('GLOBAL', 'FULL', -60_000, 60_000);
  const active = strongestScheduledWindow([a,b], 'GLOBAL', now);
  assert.equal(active?.mode, 'FULL');
  const manual = {mode: 'READ_ONLY', reason: 'Old override', expiresAt: null,
    updatedAt: now, scope: 'GLOBAL'};
  assert.equal(combinePolicyWithScheduled(manual,active,now)?.mode,'FULL');
  assert.equal(combinePolicyWithScheduled(manual,null,now)?.mode,'READ_ONLY');
});
test('NORMAL announcement never activates service restriction', () => {
  assert.equal(strongestScheduledWindow([window('GLOBAL','NORMAL',-10,10)],'GLOBAL',now),null);
});
