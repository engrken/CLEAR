import test from 'node:test';
import assert from 'node:assert/strict';
import { assertTenantSessionScope } from '../lib/tenant-session-scope.ts';

test('an officer session can use its own department', () => {
  assert.doesNotThrow(() => assertTenantSessionScope('janitorial-id', 'janitorial-id'));
});

test('a valid officer session cannot access another department even with identical email', () => {
  assert.throws(
    () => assertTenantSessionScope('janitorial-id', 'engineering-id'),
    /403 Forbidden/
  );
});

test('missing, malformed, and anonymous tenant claims fail closed', () => {
  for (const claim of [null, undefined, '', {}, 123, false]) {
    assert.throws(
      () => assertTenantSessionScope(claim, 'janitorial-id'),
      /403 Forbidden/
    );
  }
  assert.throws(() => assertTenantSessionScope('janitorial-id', ''), /403 Forbidden/);
});

test('scope matching is case-sensitive for immutable organization identifiers', () => {
  assert.throws(
    () => assertTenantSessionScope('JANITORIAL-ID', 'janitorial-id'),
    /403 Forbidden/
  );
});
