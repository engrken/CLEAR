import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('student roster debounces server-side, tenant-scoped search without dropping filters or pagination', () => {
  const src = read('app/department/[department]/(protected)/students/StudentsClient.tsx');
  assert.match(src, /searchTimer\.current = setTimeout\(\(\) => \{/);
  assert.match(src, /\}, 400\)/);
  assert.match(src, /router\.replace\(\x60\$\{pathname\}\?\$\{params\.toString\(\)\}\x60, \{ scroll: false \}\)/);
  assert.match(src, /new URLSearchParams\(window\.location\.search\)/, 'retain active tenant period and filters');
  assert.match(src, /params\.set\('page', '1'\)/, 'typing resets to first result page');
  assert.match(src, /onChange=\{e => changeSearch\(e\.target\.value\)\}/);
  assert.match(src, /onChange=\{e => \{ cancelScheduledSearch\(\); setYearFilter/, 'filter changes cancel stale search timers');
  assert.match(src, /onChange=\{e => \{ cancelScheduledSearch\(\); setStatusFilter/);
  assert.match(src, /clearRosterSearchAfterSuccess = \(\) => \{\s*cancelScheduledSearch\(\)/);
  assert.match(src, /toggleStudentStatus\(department,/, 'existing authorized enrollment actions remain');
});

test('receipt history reactively searches typed fields but keeps existing audited actions', () => {
  const src = read('app/department/[department]/(protected)/collections/history/ReceiptHistoryClient.tsx');
  assert.match(src, /scheduleSearch = \(next:/);
  assert.match(src, /\}, 450\)/);
  assert.match(src, /router\.replace\(url, \{ scroll: false \}\)/, 'automatic updates should not spam browser history');
  assert.match(src, /startNavigation\(\(\) => \{/);
  assert.match(src, /setSearch\(e\.target\.value\);\s*scheduleSearch\(/);
  assert.match(src, /setExactOrSearch\(e\.target\.value\);\s*scheduleSearch\(/);
  assert.match(src, /setDescriptionSearch\(e\.target\.value\);\s*scheduleSearch\(/);
  assert.match(src, /from: p\.from, to: p\.to/, 'date filters must not be lost');
  assert.match(src, /resendCollectionsReceipt\(p\.department/, 'receipt resend stays separately authorized');
});

test('Void Center search is reactive, with no automatic void transaction or altered confirmation', () => {
  const src = read('app/department/[department]/(protected)/void/VoidClient.tsx');
  assert.match(src, /changeSearch = \(value: string\)/);
  assert.match(src, /\}, 400\)/);
  assert.match(src, /router\.replace\(buildUrl\(category, 1, value\), \{ scroll: false \}\)/);
  assert.match(src, /onChange=\{\(event\) => changeSearch\(event\.target\.value\)\}/);
  assert.match(src, /handleCategoryChange[\s\S]*?cancelScheduledSearch\(\)/);
  assert.match(src, /handlePageChange[\s\S]*?cancelScheduledSearch\(\)/);
  assert.match(src, /executeVoidTransaction\(\{/, 'void requires its existing explicit confirmed action');
  assert.doesNotMatch(src, /useEffect\([\s\S]{0,150}executeVoidTransaction\(/);
});
