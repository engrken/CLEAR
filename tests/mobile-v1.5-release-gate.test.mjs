import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const gate = (phase = []) => spawnSync(process.execPath, ['scripts/ci/android-v15-release-gate.mjs', ...phase], {
  cwd: new URL('..', import.meta.url), encoding: 'utf8',
  env: { ...process.env, CLEAR_ANDROID_V15_UAT_APPROVED: 'false',
    CLEAR_ANDROID_V15_ROSTER_UAT_APPROVED: 'false',
    CLEAR_ANDROID_V15_PLAY_VERSIONCODE_CONFIRMED: 'false' },
});

test('web-first v1.5.0 pre-APK policy gate accepts intentionally disabled financial posting', () => {
  const result = gate();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /pre-apk static safety gate PASSED/);
  assert.doesNotMatch(result.stdout, /financial.*enabled/i);
});
test('production gate still requires signed Android, Play provenance and separate roster acceptance', () => {
  const result = gate(['--production']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Android v1.5.0 production NOT RELEASE-READY/);
  assert.match(result.stderr, /Signed Android v1.5.0 device UAT has not been approved/);
  assert.match(result.stderr, /Google Play versionCode and upload signing are not verified/);
  assert.match(result.stderr, /Native roster write UAT against authorized isolated data is not approved/);
});
