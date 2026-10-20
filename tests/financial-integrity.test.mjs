import test from 'node:test';
import assert from 'node:assert/strict';

test('package receipt suffix is distinct from base receipt', () => {
  const base = 'OR-2026-001';
  const packageLine = `${base}-P02`;
  assert.notEqual(base, packageLine);
  assert.ok(packageLine.startsWith(`${base}-P`));
});
