import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isMaintenanceEntryPath, maintenanceAdvisoryKey, maintenanceSummary }
  from '../lib/maintenance/notice-ui.ts';

const notice = (overrides = {}) => ({
  id: 'sample', title: 'CLEAR maintenance', message: 'Scheduled update.',
  startsAt: '2026-10-27T07:40:00Z', endsAt: '2026-10-27T09:36:00Z',
  revision: 1, state: 'UPCOMING', ...overrides,
});
const status = (overrides = {}) => ({
  mode: 'NORMAL', reason: '', scope: 'GLOBAL', effectiveUntil: null,
  lastChangedAt: null, notices: [notice()], ...overrides,
});

test('pre-login routes are notified without interrupting authenticated financial work', () => {
  for (const path of ['/', '/dashboard', '/dashboard/entity/login',
    '/department/jiecep', '/department/jiecep/clearance']) {
    assert.equal(isMaintenanceEntryPath(path), true, path);
  }
  for (const path of ['/department/jiecep/summary', '/department/jiecep/collections',
    '/dashboard/provisions/maintenance', '/api/maintenance/status']) {
    assert.equal(isMaintenanceEntryPath(path), false, path);
  }
});

test('notice acknowledgement tracks audience, revision, activation, and policy changes', () => {
  const base = maintenanceAdvisoryKey(status(), 'jiecep');
  assert.notEqual(base, '');
  assert.equal(base, maintenanceAdvisoryKey(status(), 'jiecep'));
  assert.notEqual(base, maintenanceAdvisoryKey(status(), 'another-tenant'));
  assert.notEqual(base, maintenanceAdvisoryKey(status({ notices: [notice({ revision: 2 })] }), 'jiecep'));
  assert.notEqual(base, maintenanceAdvisoryKey(status({ notices: [notice({ state: 'ACTIVE' })] }), 'jiecep'));
  assert.notEqual(base, maintenanceAdvisoryKey(status({
    mode: 'READ_ONLY', lastChangedAt: '2026-10-27T07:40:00Z',
  }), 'jiecep'));
  assert.equal(maintenanceAdvisoryKey(status({ notices: [] }), 'jiecep'), '');
  assert.notEqual(maintenanceAdvisoryKey(status({ mode: 'READ_ONLY', notices: [] }), 'jiecep'), '');
});

test('status copy distinguishes restrictions from notice-only advisories', () => {
  assert.match(maintenanceSummary(status()), /Scheduled:/);
  assert.match(maintenanceSummary(status({ notices: [notice({ state: 'ACTIVE' })] })), /CLEAR maintenance/);
  assert.equal(maintenanceSummary(status({ mode: 'READ_ONLY' })), 'Read-only maintenance active');
  assert.equal(maintenanceSummary(status({ mode: 'FULL' })), 'Service temporarily unavailable');
});

test('UI uses accessible opt-in detail and print exclusion, without reintroducing large banners', () => {
  const component = readFileSync(new URL('../components/MaintenanceBanner.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.match(component, /<dialog ref=\{dialogRef\}/);
  assert.match(component, /aria-labelledby="clear-service-dialog-heading"/);
  assert.match(component, /window\.sessionStorage\.setItem/);
  assert.match(component, /View details/);
  assert.match(component, /className="clear-service-status d-print-none"/);
  assert.match(css, /@media print\s*\{[^}]*\.clear-service-status,[\s\S]*?\.clear-service-dialog/);
  assert.doesNotMatch(component, /className="alert alert-warning"/);
});
