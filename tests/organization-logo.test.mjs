import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ORGANIZATION_LOGO, getOrganizationLogoSrc } from '../lib/organization-logo.ts';

test('CLEAR png is the only fallback when tenant has no configured logo', () => {
  assert.equal(DEFAULT_ORGANIZATION_LOGO, '/clearsys.png');
  for (const input of [null, undefined, '', '  ', '\n\t']) {
    assert.equal(getOrganizationLogoSrc(input), DEFAULT_ORGANIZATION_LOGO);
  }
});

test('uploaded logos always take precedence over CLEAR fallback', () => {
  const savedLogo = 'https://store.example.invalid/department/logo.webp';
  assert.equal(getOrganizationLogoSrc(savedLogo), savedLogo);
  assert.equal(getOrganizationLogoSrc('  /school-logo.png  '), '/school-logo.png');
});
