/**
 * Prevent drift between the authenticated web finance engine and the mobile
 * API's read-only mirror. Both must produce identical accounting outputs.
 *
 * The web action has an auth guard; mobile routes authorize bearer sessions
 * separately. The mobile helper also returns two extra read-only metadata
 * fields. Everything inside the accounting calculation must remain identical.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function financeBody(raw, name) {
  // Windows checkouts use CRLF; compare logic, not line endings.
  const source = raw.replace(/\r\n/g, '\n');
  const start = source.indexOf(`export async function ${name}(`);
  assert.notEqual(start, -1, `Missing finance function ${name}`);
  const bodyStart = source.indexOf('  const [', start);
  const end = source.indexOf('\n}\n', bodyStart);
  assert.ok(bodyStart > start && end > bodyStart, `Cannot extract finance engine ${name}`);
  return source.slice(bodyStart, end)
    .split('\n')
    .filter(line => {
      const s = line.trim();
      return s && !s.startsWith('//') &&
        !s.startsWith('unpaidPackageStudents:') &&
        s !== 'periodLedger,';
    })
    .map(line => line.trim().replace(/\s+/g, ' '))
    .join('\n');
}

test('Mobile accounting math matches authenticated web finance engine exactly', () => {
  const web = readFileSync(path.join(root, 'app/department/[department]/actions.ts'), 'utf8');
  const mobile = readFileSync(path.join(root, 'lib/financials.ts'), 'utf8');
  assert.ok(mobile.includes("import { manilaDateInput } from '@/lib/clear-timezone';"),
    'Mobile period dates must use Philippine time, not UTC string splitting.');
  assert.equal(
    financeBody(mobile, 'computeDepartmentFinancials'),
    financeBody(web, 'getDepartmentFinancials'),
    'Web finance logic changed; update the mobile mirror and retest before merging.',
  );
});
