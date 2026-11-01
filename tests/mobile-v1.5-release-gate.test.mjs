import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

/** A v1.5.0 candidate must not be declared releasable while critical guards are disabled. */
test('release gate refuses current incomplete v1.5 candidate', () => {
  const result = spawnSync(process.execPath, ['scripts/ci/android-v15-release-gate.mjs'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /NOT RELEASE-READY/);
  assert.match(result.stderr, /Native payment posting is disabled/);
  assert.match(result.stderr, /seamless web sign-in is disabled/);
});
