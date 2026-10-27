import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('maintenance forms use inline useActionState feedback and do not submit raw error-throwing actions', () => {
  const page = read('app/dashboard/provisions/maintenance/page.tsx');
  const forms = read('app/dashboard/provisions/maintenance/MaintenanceForms.tsx');
  assert.match(page, /<MaintenancePolicyForm options=\{options\}/);
  assert.match(page, /<MaintenanceNoticeCreateForm options=\{options\}/);
  assert.match(page, /<MaintenanceNoticeEditForms/);
  assert.doesNotMatch(page, /<form action=\{(?:setMaintenancePolicy|createMaintenanceNotice|editMaintenanceNotice)\}/);
  for (const action of [
    'submitMaintenancePolicy', 'submitMaintenanceNotice', 'submitMaintenanceNoticeEdit',
  ]) {
    assert.ok(forms.includes('useActionState(' + action + ', idle)'), action);
  }
  assert.match(forms, /role=\{state\.status === 'error' \? 'alert' : 'status'\}/);
  assert.match(forms, /aria-live="polite"/);
  assert.match(forms, /disabled=\{pending\}/);
  assert.match(forms, /minLength=\{5\}/);
  assert.match(forms, /minLength=\{10\}/);
});

test('only expected validation errors appear inline; authentication and database failures propagate', () => {
  const actions = read('app/dashboard/provisions/maintenance/actions.ts');
  assert.match(actions, /class MaintenanceInputError extends Error/);
  assert.match(actions, /error instanceof MaintenanceInputError/);
  assert.match(actions, /throw error;/);
  assert.match(actions, /await requireSuperAdmin\(true\)/);
  for (const fn of ['setMaintenancePolicy', 'createMaintenanceNotice', 'editMaintenanceNotice']) {
    assert.ok(actions.includes('() => ' + fn + '(form)'), fn);
  }
  assert.match(actions, /A clear maintenance reason is required/);
  assert.match(actions, /Provide a title and a meaningful notice/);
  assert.match(actions, /Maintenance policy saved/);
  assert.match(actions, /Notice updated and recorded/);
});

test('transactional maintenance audit and confirming operator identity are preserved', () => {
  const actions = read('app/dashboard/provisions/maintenance/actions.ts');
  assert.match(actions, /prisma\.\$transaction\(async tx =>/);
  assert.match(actions, /tx\.maintenanceAudit\.create\(/);
  assert.match(actions, /type MaintenanceFormState/);
  assert.match(actions, /confirmation/);
  assert.match(actions, /'RESTORE NORMAL' : 'APPLY MAINTENANCE'/);
});
