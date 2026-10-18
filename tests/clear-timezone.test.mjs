import test from 'node:test';
import assert from 'node:assert/strict';
import {
  manilaDateInput, formatManilaDateTime24, manilaDayWindow,
  manilaYear, manilaMonth, CLEAR_TIME_ZONE,
} from '../lib/clear-timezone.ts';

test('canonical zone', () => {
  assert.equal(CLEAR_TIME_ZONE, 'Asia/Manila');
});
test('PHT calendar rolls forward when UTC is still yesterday', () => {
  const at = new Date('2026-10-18T16:15:00Z');
  assert.equal(manilaDateInput(at), '2026-10-19');
  assert.equal(formatManilaDateTime24(at), '2026-10-19 00:15:00 PHT');
  assert.equal(manilaMonth(at), 10);
  assert.equal(manilaYear(at), 2026);
});
test('Manila local day range maps to UTC half-open interval', () => {
  const { start, end } = manilaDayWindow('2026-10-19');
  assert.equal(start.toISOString(), '2026-10-18T16:00:00.000Z');
  assert.equal(end.toISOString(), '2026-10-19T16:00:00.000Z');
});
test('year rollover follows Philippine calendar', () => {
  assert.equal(manilaYear(new Date('2026-12-31T16:30:00Z')), 2027);
  assert.equal(manilaMonth(new Date('2026-12-31T16:30:00Z')), 1);
});
test('reject malformed and nonexistent dates', () => {
  assert.throws(() => manilaDayWindow('2026-02-30'));
  assert.throws(() => manilaDayWindow('10/19/2026'));
});
