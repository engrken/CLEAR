import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const actions = source('app/department/[department]/(protected)/students/actions.ts');
const web = source('app/department/[department]/(protected)/students/StudentsClient.tsx');
const otp = source('lib/mobile/student-clearance-auth.ts');

test('only authorized tenant-roster users may update student identity and email', () => {
  assert.match(actions, /requireTabAccess\('tab-students', dept\)/);
  assert.match(actions, /organizationId: orgId/);
  assert.match(actions, /organizationId: orgId, id: \{ not: old\.id \}, email: \{ equals: email, mode: 'insensitive' \}/);
});

test('assisted email enrollment requires fresh officer attestation and never clears an OTP destination', () => {
  const edit = actions.slice(actions.indexOf('export async function saveStudent'), actions.indexOf('export async function deleteStudent'));
  assert.match(edit, /const emailChanged = previousEmail !== email/);
  assert.match(edit, /if \(emailChanged\) \{[\s\S]*?if \(!formData\.emailChangeIdentityVerified\)/);
  assert.match(edit, /if \(!email\) throw new Error\('Do not clear a registered email/);
  assert.match(edit, /if \(emailOwner\) throw new Error\('Email address is already assigned/);
  assert.match(edit, /STUDENT_EMAIL_IDENTITY_REVIEW/);
  assert.match(edit, /TransactionIsolationLevel\.Serializable/);
  assert.doesNotMatch(edit, /details: .*\b(?:email|rawCode|token)\b/);
  assert.match(web, /emailChangeIdentityVerified: formData\.get\("emailChangeIdentityVerified"\) === "on"/);
  assert.match(web, /name="emailChangeIdentityVerified"/);
  assert.match(web, /Changing a roster address does not bypass OTP|must still verify their email by OTP/);
});

test('CSV import preserves all existing student emails, including empty and differing CSV columns', () => {
  const importSection = actions.slice(actions.indexOf('export async function bulkImportStudents'));
  const existingSection = importSection.slice(importSection.indexOf('if (existing) {'), importSection.indexOf('} else {\n        if (row.email'));
  assert.match(existingSection, /data: \{ fullName: row\.fullName, yearLevel: row\.yearLevel \}/);
  assert.doesNotMatch(existingSection, /data:\s*\{[^}]*\bemail\s*:/);
  assert.match(importSection, /preservedEmails\+\+/);
  assert.match(importSection, /TransactionIsolationLevel\.Serializable/);
  assert.match(importSection, /organizationId: orgId, email: \{ equals: row\.email, mode: 'insensitive' \}/);
  assert.match(web, /Existing students' registered emails are preserved/);
  assert.match(web, /registered emails will not be overwritten by CSV/);
});

test('mailbox possession is still verified via short-lived, single-use student OTP', () => {
  assert.match(otp, /OTP_TTL_MS = 5 \* 60_000/);
  assert.match(otp, /requireStudentClearanceSession/);
  assert.match(otp, /emailHash: digest\('email', norm\(student\.email\)\)/);
  assert.match(otp, /p\.emailHash !== digest\('email', norm\(student\.email\)\)/);
  assert.match(otp, /verificationToken\.deleteMany/);
});
