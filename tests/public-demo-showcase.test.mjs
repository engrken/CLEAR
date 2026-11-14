import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const landing = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const demo = readFileSync(new URL('../app/demo/page.tsx', import.meta.url), 'utf8');
const fixtures = readFileSync(new URL('../lib/demo-workspace-data.ts', import.meta.url), 'utf8');
const sidebar = readFileSync(new URL('../app/department/[department]/Sidebar.tsx', import.meta.url), 'utf8');
const presets = readFileSync(new URL('../lib/role-permissions.ts', import.meta.url), 'utf8');
const bypass = readFileSync(new URL('../lib/demo-reviewer.ts', import.meta.url), 'utf8');

test('landing links to role-based demo rather than public credentials', () => {
  assert.match(landing, /id="try-demo"/);
  assert.match(landing, /href="\/demo"/);
  assert.match(landing, /Auditor/);
  assert.doesNotMatch(landing, /login credentials are pre-configured/i);
});

test('public demo reflects all real tenant sidebar module links', () => {
  const required = [
    ['Overview', 'tab-overview'], ['Clearance', 'tab-clearance'], ['Students Roster', 'tab-students'],
    ['Collections', 'tab-payment'], ['Remittance Queue', 'tab-remittances'],
    ['Univ. Cashier Deposit', 'tab-payment'], ['Cash Advances', 'tab-advances'],
    ['Liquidations', 'tab-audit'], ['Penalties & Fines', 'tab-penalties'],
    ['Collectibles & Dues', 'tab-collectibles'], ['Detailed Reports', 'tab-reports'],
    ['Summary Report', 'tab-report'], ['Realign Funds', 'tab-transfer'],
    ['Void Center', 'tab-void'], ['User Management', 'tab-users'],
    ['System Logs', 'admin-only'], ['System Setup', 'tab-setup']
  ];
  for (const [name, permission] of required) {
    assert.ok(sidebar.includes(name), 'Missing production sidebar label: ' + name);
    assert.ok(fixtures.includes("label: '" + name + "'"), 'Demo lacks module ' + name);
    assert.ok(fixtures.includes("tab: '" + permission + "'"), 'Demo lacks permission ' + permission);
  }
  assert.match(demo, /PRESET_ROLE_TABS/);
  assert.match(presets, /treasurer:/);
  assert.match(presets, /auditor:/);
  assert.match(presets, /viewer:/);
  assert.match(demo, /role === "officer" \? PRESET_ROLE_TABS.viewer/);
});

test('the demo is a self-contained fictional read-only walkthrough', () => {
  assert.match(demo, /Read-only demo/);
  assert.match(fixtures, /DEMO-ST-001/);
  assert.match(fixtures, /DEMO-OR-001/);
  assert.match(fixtures, /DEMO-CA-001/);
  assert.match(fixtures, /DEMO-LOG-001/);
  assert.match(demo, /"Pending Advances"/);
  assert.match(demo, /"Fund Balances"/);
  const source = demo + fixtures;
  assert.doesNotMatch(source, /\bfetch\s*\(|\bprisma\s*\.|\bsignIn\s*\(|\brequestOtp\s*\(|\bserver action\b|["']use server["']/i);
  assert.doesNotMatch(source, /RESEND_API_KEY|SMTP_PASSWORD|DATABASE_URL/);
});

test('reviewer bypass remains deliberately disabled', () => {
  assert.match(bypass, /isDemoReviewerEnabled\(\): boolean \{ return false; \}/);
  assert.match(bypass, /demoReviewerCode\([^\n]+\): string \| null \{ return null; \}/);
});
