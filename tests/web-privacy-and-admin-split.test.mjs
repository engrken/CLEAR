import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('data privacy is mounted once and does not depend on Bootstrap modal timing', () => {
  const root = src('app/layout.tsx');
  const department = src('app/department/[department]/layout.tsx');
  const modal = src('app/department/[department]/components/DataPrivacyModal.tsx');
  assert.match(root, /<DataPrivacyModal\s*\/>/);
  assert.doesNotMatch(department, /<DataPrivacyModal\s*\/>/);
  assert.match(modal, /<dialog ref=\{dialogRef\}/);
  assert.match(modal, /dialogRef\.current\?\.close\(\)/);
  assert.match(modal, /clear_privacy_accepted/);
  assert.match(modal, /I Understand &amp; Agree/);
  assert.doesNotMatch(modal, /bootstrap\.Modal/);
  assert.doesNotMatch(modal, /modal-open/);
});

test('native privacy dialog owns scrolling and is excluded from financial printing', () => {
  const css = src('app/globals.css');
  assert.match(css, /\.clear-privacy-dialog-body\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /@media print\s*\{\s*\.clear-privacy-dialog/s);
  assert.match(src('app/department/[department]/components/DataPrivacyModal.tsx'), /d-print-none/);
});

test('tenant provisioning is clean, with protected administrator and audit pages', () => {
  const overview = src('app/dashboard/provisions/page.tsx');
  const admins = src('app/dashboard/provisions/administrators/page.tsx');
  const logs = src('app/dashboard/provisions/security-audit/page.tsx');
  assert.match(overview, /href="\/dashboard\/provisions\/administrators"/);
  assert.match(overview, /href="\/dashboard\/provisions\/security-audit"/);
  assert.doesNotMatch(overview, /<GlobalAdminManager/);
  assert.doesNotMatch(overview, /globalAdminAudit\.findMany/);
  assert.match(admins, /await requireSuperAdmin\(\)/);
  assert.match(admins, /<GlobalAdminManager accounts=\{accounts\}/);
  assert.match(logs, /await requireSuperAdmin\(\)/);
  assert.match(logs, /globalAdminAudit\.count\(\)/);
  assert.match(logs, /take: PAGE_SIZE/);
  assert.match(logs, /skip: \(page - 1\) \* PAGE_SIZE/);
  assert.match(logs, /createdAt: 'desc'.*id: 'desc'/s);
  assert.match(logs, /Page \{page\} of \{pages\}/);
  assert.match(logs, /records cannot be modified|Records cannot be modified/);
});

test('administrator changes invalidate new accounts and audit pages', () => {
  const actions = src('app/dashboard/provisions/super-admin-actions.ts');
  assert.match(actions, /revalidatePath\(MANAGE_PATH \+ '\/administrators'\)/);
  assert.match(actions, /revalidatePath\(MANAGE_PATH \+ '\/security-audit'\)/);
  assert.match(actions, /await requireSuperAdmin\(\)/);
  assert.match(actions, /globalAdminAudit\.create/);
});
