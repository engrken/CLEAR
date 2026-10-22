import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Android Overview exposes the same canonical financial totals as the web dashboard', () => {
  const web = read('app/department/[department]/DashboardClient.tsx');
  const finance = read('lib/mobile/data.ts');
  const fields = [
    ['grandCollectionTotal', 'totalCollectedCentavos'],
    ['grandExpenseTotal', 'totalExpensesCentavos'],
    ['totalUnliquidated', 'unliquidatedCentavos'],
    ['remainingBalance', 'remainingBalanceCentavos'],
    ['cashierBalance', 'safekeepingCentavos'],
    ['totalDeposited', 'depositedCentavos'],
    ['totalWithdrawn', 'withdrawnCentavos'],
    ['carryOverInboundTotal', 'carriedInCentavos'],
    ['carryOverOutboundTotal', 'carriedOutCentavos'],
  ];
  for (const [sourceKey, apiKey] of fields) {
    assert.ok(web.includes(sourceKey), 'Web Overview missing ' + sourceKey);
    assert.ok(finance.includes(apiKey + ': toCentavos(fin.' + sourceKey + ')'),
      'Android dashboard must serialize canonical finance field ' + sourceKey);
  }
  assert.match(finance, /cashOnHandCentavos: toCentavos\(fin\.remainingBalance - fin\.cashierBalance\)/);
  assert.match(finance, /funds: fin\.fundsList\.map/);
  assert.match(finance, /pendingAdvances: fin\.unliquidatedAdvances\.map/);
});

test('financial details are available only to authorized tenants, and all dashboard routes are GET only', () => {
  const officer = read('app/api/mobile/orgs/[org]/dashboard/route.ts');
  const global = read('app/api/mobile/global/orgs/[org]/dashboard/route.ts');
  assert.match(officer, /requireMobileOfficer\(req, slug, 'tab-overview'\)/);
  assert.match(global, /requireGlobalMobileTenant\(req, slug\)/);
  for (const route of [officer, global]) {
    assert.match(route, /export const GET = handler/);
    assert.doesNotMatch(route, /export const (?:POST|PATCH|PUT|DELETE)/);
  }
});

test('both authorized overview screens use the same breakdown component', () => {
  const officer = read('mobile/src/app/(officer)/home.tsx');
  const global = read('mobile/src/app/global/tenant/[org].tsx');
  const details = read('mobile/src/components/overview/FinancialOverview.tsx');
  assert.match(officer, /can\('tab-overview'\)/);
  assert.match(officer, /canOverview && stats \? <FinancialOverview stats=\{stats\}/);
  assert.match(global, /<FinancialOverview stats=\{financials\}/);
  for (const label of [
    'Total collections', 'Active unliquidated', 'Audited expenses',
    'Net treasury balance', 'University Cashier', 'Physical cash on hand',
    'Pending advances', 'Fund balances', 'Cash flow velocity',
  ]) {
    assert.ok(details.includes(label), 'Missing on mobile Overview: ' + label);
  }
  assert.match(details, /The current server has not supplied the expanded financial figures/);
  assert.doesNotMatch(details, /api\.recordPayment|api\.verifyRemittance|api\.manageTenant/);
});

test('first-open mobile data privacy notice mirrors web content and remains accessible', () => {
  const web = read('app/department/[department]/components/DataPrivacyModal.tsx');
  const notice = read('mobile/src/components/privacy/DataPrivacyNotice.tsx');
  const root = read('mobile/src/app/_layout.tsx');
  const more = read('mobile/src/app/(officer)/more.tsx');
  assert.match(web, /Data Privacy Notice & Consent/);
  assert.match(notice, /Data Privacy Notice &amp; Consent/);
  for (const section of [
    '1. Information We Process', '2. Purpose of Processing', '3. Access and Storage',
  ]) {
    assert.ok(web.includes(section) && notice.includes(section), section);
  }
  assert.match(notice, /Mask or redact personal mobile numbers/);
  assert.match(notice, /registered-email verification/);
  assert.match(notice, /openWebPage\(PRIVACY_URL\)/);
  assert.match(root, /getItem\('clear_privacy_notice_ack_v1'\)/);
  assert.match(root, /setItem\('clear_privacy_notice_ack_v1', 'true'\)/);
  assert.match(root, /visible=\{!privacyAcknowledged\}/);
  assert.match(more, /View data privacy notice/);
  assert.match(more, /<DataPrivacyNotice visible=\{privacyOpen\}/);
});
