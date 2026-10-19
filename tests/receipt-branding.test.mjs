import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveReceiptBranding } from '../lib/receipt-branding.ts';

test('renders configured school, college, and address independently', () => {
  assert.deepEqual(resolveReceiptBranding({ name: 'College of Engineering',
    reportSchoolName: 'Filamer Christian University', reportSchoolAddress: 'Roxas City' }), {
    schoolName: 'Filamer Christian University',
    organizationName: 'College of Engineering', schoolAddress: 'Roxas City',
    configuredSchoolName: true, showOrganizationLine: true,
  });
});

test('fallback for missing school identity uses the organization name', () => {
  assert.deepEqual(resolveReceiptBranding({
    name: 'College of Janitorial', reportSchoolName: '   ', reportSchoolAddress: null,
  }), {
    schoolName: 'College of Janitorial', organizationName: 'College of Janitorial',
    schoolAddress: '', configuredSchoolName: false, showOrganizationLine: false,
  });
});

test('duplicate school and organization headers are suppressed case-insensitively', () => {
  const data = resolveReceiptBranding({
    name: 'Student Council', reportSchoolName: ' student council ',
  });
  assert.equal(data.configuredSchoolName, true);
  assert.equal(data.showOrganizationLine, false);
});

test('values are trimmed while preserving distinct school and tenant names', () => {
  const data = resolveReceiptBranding({
    name: ' College of Electronics ', reportSchoolName: ' School Name ',
    reportSchoolAddress: ' School Road ',
  });
  assert.equal(data.schoolName, 'School Name');
  assert.equal(data.organizationName, 'College of Electronics');
  assert.equal(data.schoolAddress, 'School Road');
});
