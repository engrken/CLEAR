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
  assert.match(result.stderr, /Server-issued mobile write capabilities remain deny-all/);
  assert.doesNotMatch(result.stderr, /UAT has not been approved/, 'device UAT follows the internal APK');
});

test('production release gate additionally requires post-build UAT and SSO rollout', () => {
  const result = spawnSync(process.execPath, ['scripts/ci/android-v15-release-gate.mjs', '--production'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8',
    env: { ...process.env, MOBILE_WEB_HANDOFF_ENABLED: 'false', CLEAR_ANDROID_V15_UAT_APPROVED: 'false' },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Secure mobile-to-web SSO has not been enabled and UAT-verified/);
  assert.match(result.stderr, /Android v1.5.0 device UAT has not been approved/);
});
