import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('financial cutover gate blocks login, old sessions, mobile APIs and transaction requests', () => {
  const source = read('proxy.ts');
  assert.match(source, /process\.env\.CLEAR_MAINTENANCE_MODE === 'locked'/);
  assert.match(source, /pathname\.startsWith\('\/api\/'\) \|\| request\.method !== 'GET'/);
  assert.match(source, /NextResponse\.json\([\s\S]*?status: 503/);
  assert.match(source, /NextResponse\.redirect\(maintenanceUrl, \{ status: 307, headers \}\)/);
  assert.match(source, /matcher: \['\/\(\(\?!_next\/static\|_next\/image\|favicon\.ico\)\.\*\)'\]/);
  assert.doesNotMatch(source, /matcher:[^\n]*api\//);
});

test('maintenance notice remains accessible but does not allow financial writes', () => {
  const source = read('proxy.ts');
  const view = read('app/maintenance/page.tsx');
  assert.match(source, /pathname === '\/maintenance' && request\.method === 'GET'/);
  assert.match(view, /Scheduled system maintenance/);
  assert.match(view, /financial transactions are temporarily unavailable/);
  assert.match(view, /Do not resubmit a payment/);
  assert.match(view, /index: false, follow: false/);
});

test('localhost tenant rewrite is preserved independently of maintenance', () => {
  const source = read('proxy.ts');
  assert.match(source, /\.localhost\$/);
  assert.match(source, /NextResponse\.rewrite\(destination\)/);
  assert.match(source, /pathname\.startsWith\('\/department\/'\)/);
});
