// Consolidated CLEAR source regression gate. No Production connection or writes.
// Real HTTP/PostgreSQL integration tests are exercised by separate PR checks
// against disposable synthetic PostgreSQL, not by this source runner.
import { readdirSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const files = readdirSync(path.join(root, 'tests'))
  .filter(name => name.endsWith('.test.mjs') && !name.startsWith('ci-'))
  .sort().map(name => 'tests/' + name);
if (files.length < 30) throw new Error('Expected at least 30 safe standalone test files. Refusing partial discovery.');
const env = { ...process.env, DATABASE_URL: '', DATABASE_URL_UNPOOLED: '',
  DIRECT_URL: '', NEON_DATABASE_URL: '', CLEAR_CI_FINANCE_TEST_ENABLED: '',
  CLEAR_CI_STUDENT_AUTH_TEST_ENABLED: '' };
const result = spawnSync(process.execPath,
  ['--experimental-strip-types', '--test', '--test-reporter=tap', ...files],
  { cwd: root, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    timeout: 8 * 60_000 });
const log = [result.stdout || '', result.stderr || ''].join('\n');
const count = (key) => {
  const match = log.match(new RegExp('^# ' + key + ' (\\d+)$', 'm'));
  return match ? Number(match[1]) : null;
};
const tests = count('tests'), passed = count('pass'), failed = count('fail');
const ok = result.status === 0 && !result.error &&
  tests !== null && passed === tests && failed === 0;
console.log('CLEAR one-shot source acceptance: ' + (ok ? 'PASS' : 'FAIL'));
console.log('Discovered files: ' + files.length);
console.log('Tests: ' + tests + '; passed: ' + passed + '; failed: ' + failed);
if (!ok) {
  // Surface the actual failing test names before the aggregate TAP summary.
  // The former tail-only log hid failures when hundreds of passing cases followed.
  const failureDetails = log.split('\n').filter(line =>
    /^not ok \d+ - /.test(line) || /^\s+(?:failureType|error|location|code):/.test(line)
  );
  console.error('Failing TAP assertions:\n' + failureDetails.join('\n'));
  console.error('Final TAP summary:\n' + log.split('\n').slice(-50).join('\n'));
  if (result.error) console.error(result.error.message);
}
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
    '## CLEAR consolidated acceptance — source/static contracts',
    '',
    '| Area | Result |',
    '|---|---|',
    '| All standalone tests: finance, OTP, privacy, roles, receipts, search, time, UI parity | ' +
      (ok ? 'PASS' : 'FAIL') + ' (' + passed + '/' + tests + ') |',
    '| Test files auto-discovered | ' + files.length + ' |',
    '| Isolated financial/student runtime tests | Separate PostgreSQL PR workflow gates |',
    '| Android native UI/device and Google Play rollout | Manual Play-distributed app acceptance |',
    '| QR real camera scan / opaque verifier | Not yet implemented or accepted (#57) |',
    '| Production response-time p50/p95 | Needs measured staging benchmark (#70) |',
    '| Native business writes | Intentionally blocked (#81) |',
    '',
    'This source runner has no database connectivity; it does not change Production data.',
    '',
  ].join('\n'));
}
if (!ok) process.exitCode = 1;
