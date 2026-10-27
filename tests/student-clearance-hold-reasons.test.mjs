import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildVerifiedStudentReasons } from '../lib/student-clearance-reasons.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
// Synthetic values only. Verify exact centavos and no silent truncation.
const exactCents = pesos => {
  const cents = Math.round(pesos * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(pesos - cents / 100) > 0.00000001)
    throw new Error('Invalid monetary precision');
  return cents;
};

test('cleared has no reasons; unenrolled has enrollment notice without invented package debt', () => {
  assert.deepEqual(buildVerifiedStudentReasons(true, [], exactCents), []);
  assert.deepEqual(buildVerifiedStudentReasons(false, [], exactCents), [{
    kind: 'enrollment',
    label: 'Enrollment has not been confirmed for the current term.',
    amountCentavos: null,
  }]);
});

test('verified student gets exact package, assessment, penalty and previous-term dues', () => {
  const reasons = buildVerifiedStudentReasons(true, [
    { category: 'Departmental Fee', itemDescription: 'Mandatory Package Balance', balanceDue: 450 },
    { category: 'Activities', itemDescription: 'Event contribution', balanceDue: 25.5 },
    { category: 'Penalty', itemDescription: 'Unsettled Fine / Arrears', balanceDue: 221.67 },
    { category: 'Collectible', itemDescription: 'Laboratory Fee', balanceDue: 50 },
    { category: 'Penalty — Previous Period', itemDescription: 'Old fine', balanceDue: 30, originAy: '2025-2026', originTerm: '2nd Sem' },
  ], exactCents);
  assert.deepEqual(reasons.map(x => x.kind), ['package', 'assessment', 'penalty', 'collectible', 'previous_period']);
  assert.deepEqual(reasons.map(x => x.amountCentavos), [45000, 2550, 22167, 5000, 3000]);
  assert.deepEqual([reasons[4].academicYear, reasons[4].term], ['2025-2026', '2nd Sem']);
});

test('cash advance is a pending liquidation action, not an amount to pay or an internal reference', () => {
  const reasons = buildVerifiedStudentReasons(true, [{
    category: 'Cash Advance', itemDescription: 'Unliquidated CA [CA-PRIVATE-123]',
    balanceDue: 1000,
  }], exactCents);
  assert.deepEqual(reasons, [{
    kind: 'cash_advance', label: 'Cash advance awaiting liquidation', amountCentavos: null,
  }]);
  assert.doesNotMatch(JSON.stringify(reasons), /CA-PRIVATE-123|studentId|receipt|paymentReference/i);
});

test('financial precision errors fail closed; arbitrary source labels are bounded and stripped of controls', () => {
  assert.throws(() => buildVerifiedStudentReasons(true, [{
    category: 'Assessment', itemDescription: 'Fee', balanceDue: 1.001,
  }], exactCents), /precision/);
  const reasons = buildVerifiedStudentReasons(true, [{
    category: 'Collectible', itemDescription: ' Lab\nCharge ' + 'A'.repeat(200), balanceDue: 2,
  }], exactCents);
  assert.ok(reasons[0].label.length <= 110);
  assert.doesNotMatch(reasons[0].label, /[\n\r]/);
});

test('only student OTP branch receives itemized reasons; public QR and officers are unchanged', () => {
  const api = read('app/api/mobile/orgs/[org]/clearance/route.ts');
  const web = read('app/department/[department]/clearance/StudentClearanceInquiry.tsx');
  const mobile = read('mobile/src/app/d/[dept]/clearance.tsx');
  const routeOfficer = api.indexOf('if (query) {');
  const session = api.indexOf('const student = await requireStudentClearanceSession(req, org)');
  const reasons = api.indexOf('const holdReasons = result.isCleared');
  assert.ok(routeOfficer >= 0 && routeOfficer < session && session < reasons);
  assert.match(api, /result\.student\.id !== student\.id/);
  assert.match(api, /buildVerifiedStudentReasons\(result\.isEnrolled, result\.unpaidItems, toCentavos\)/);
  assert.match(api, /studentName: null/);
  assert.match(api, /outstandingCentavos: null/);
  assert.match(api, /unpaidItems: null/);
  assert.match(api, /qrToken: studentQrUrl/);
  assert.doesNotMatch(api.slice(routeOfficer, session), /holdReasons/);
  assert.match(web, /validReasons\(privateResult\.holdReasons\)/);
  assert.match(web, /Why your clearance is not ready for signing/);
  assert.match(web, /setResult\(null\)/);
  assert.match(web, /visibilitychange/);
  assert.match(mobile, /AppState\.addEventListener\('change'/);
  assert.match(mobile, /holdReasons=\{!officerMode \? result\.holdReasons : undefined\}/);
  const publicVerifier = read('app/clearance/verify/page.tsx');
  assert.doesNotMatch(publicVerifier, /holdReasons|buildVerifiedStudentReasons/);
});

test('the privacy notices accurately describe OTP-only account visibility', () => {
  const noticeWeb = read('app/department/[department]/components/DataPrivacyModal.tsx');
  const noticeApp = read('mobile/src/components/privacy/DataPrivacyNotice.tsx');
  assert.match(noticeWeb, /registered-email verification/);
  assert.match(noticeApp, /registered-email verification/);
  assert.match(noticeWeb, /other students/);
  assert.match(noticeApp, /other students/);
});
