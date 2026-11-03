import test from 'node:test';
import assert from 'node:assert/strict';
import { assessSubscriptionAccess, validateManualInstaPayApproval } from '../lib/subscriptions/option-b-policy.ts';

const due = '2026-11-03T12:00:00+08:00';
test('Freemium is not subject to subscription payment suspension', () => {
  assert.equal(assessSubscriptionAccess({tier:'Freemium',paidThrough:null,now:'2026-11-20T00:00:00+08:00'}).access,'CURRENT');
});
test('Paid plan with no independently verified current period cannot acquire paid entitlements', () => {
  const r=assessSubscriptionAccess({tier:'Pro',paidThrough:null,now:due});
  assert.equal(r.access,'UNVERIFIED'); assert.equal(r.operationalMode,'READ_ONLY');
  assert.equal(r.studentClearanceReadable,true);
});
test('Grace ends after seven full Manila calendar days, not after seven UTC dates', () => {
  const at=now=>assessSubscriptionAccess({tier:'Corporate',paidThrough:due,now});
  assert.equal(at('2026-11-03T23:59:59+08:00').access,'CURRENT');
  assert.equal(at('2026-11-04T00:00:00+08:00').access,'GRACE');
  assert.equal(at('2026-11-10T23:59:59+08:00').access,'GRACE');
  assert.equal(at('2026-11-11T00:00:00+08:00').access,'SUSPENDED');
  assert.equal(at('2026-11-11T00:00:00+08:00').operationalMode,'READ_ONLY');
});
test('Manila date conversion preserves grace cutoff across UTC boundaries', () => {
  const r=assessSubscriptionAccess({tier:'Pro',paidThrough:due,now:'2026-11-10T16:00:00Z'});
  assert.equal(r.access,'SUSPENDED');
});
test('Billing dates must be offset aware', () => {
  assert.throws(()=>assessSubscriptionAccess({tier:'Pro',paidThrough:'2026-11-03',now:due}),/timezone/);
});
const payment={
 invoiceId:'invoice-1',invoiceStatus:'PENDING_VERIFICATION',
 expectedCentavos:12345n,receivedCentavos:12345n,
 bankCreditIndependentlyVerified:true,bankReference:'202611030001',
 reviewerId:'global-admin-1',payerId:'payer-1',
};
test('Only independently bank-reconciled exact amounts yield a deterministic approval key', () => {
  const approval=validateManualInstaPayApproval(payment);
  assert.equal(approval.receivedCentavos,12345n);
  assert.equal(approval.uniqueApprovalKey,'invoice-1:202611030001');
  assert.deepEqual(validateManualInstaPayApproval(payment),approval);
});
test('Reject proof-only, overpayment, self-approval and duplicate invoice approval attempts', () => {
  for(const patch of [
    {bankCreditIndependentlyVerified:false},
    {receivedCentavos:12346n},
    {reviewerId:'payer-1'},
    {invoiceStatus:'VERIFIED'},
    {invoiceStatus:'REJECTED'},
    {bankReference:'invalid reference!'},
  ]) assert.throws(()=>validateManualInstaPayApproval({...payment,...patch}));
});
