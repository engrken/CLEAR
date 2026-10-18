/* Offline business-rule tests for assessment-void.ts (NO database connection). */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const target = path.resolve(__dirname, '../app/department/[department]/(protected)/collectibles/assessment-void.ts');
const source = fs.readFileSync(target, 'utf8');
const compiled = ts.transpileModule(source, {
  fileName: target, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleObject = { exports: {} };
new Function('require', 'module', 'exports', compiled)(name => {
  if (name === './due-link') return { decodeStudentDue(status) {
    const m = String(status).match(/\|SID:([^|]+)\|ITEM:([^|]+)/);
    return m ? { studentId: decodeURIComponent(m[1]), itemDescription: decodeURIComponent(m[2]) } : null;
  } };
  throw new Error('Unexpected dependency ' + name);
}, moduleObject, moduleObject.exports);
const { voidStudentCollectibleAssessment } = moduleObject.exports;
function fixtures(overrides = {}) {
  const due = {
    id: 'ASSESS-1', organizationId: 'ORG-A', academicYear: 'A.Y. 2026 - 2027', term: '1st Sem',
    category: 'Events', headcount: 1, status: 'Unpaid|SID:STU001|ITEM:Yearbook', balanceDue: 100,
    ...overrides.due,
  };
  let updates = 0;
  const tx = {
    collectible: {
      async findFirst({where}) { return where.organizationId === due.organizationId && where.id === due.id ? due : null; },
      async findMany() { return overrides.duplicates || [{ id: due.id, status: due.status }]; },
      async updateMany({data}) { updates++; due.status = data.status; due.balanceDue = data.balanceDue; return { count: 1 }; },
    },
    student: { async findFirst() { return { id: 'DB-STU-1', studentId: 'STU001' }; } },
    onlineRemittance: { async findMany() { return overrides.pending || []; } },
    collectionSetup: { async findMany() { return [{ amount: 100 }]; } },
    collection: { async findMany() {
      const n = ++tx.collection.reads;
      return n === 1 ? (overrides.receipts || []) : (overrides.linkedReceipts || []);
    }, reads: 0 },
    arrearPaymentLink: { async findMany() { return overrides.links || []; } },
  };
  return {tx,due,updated: () => updates};
}
async function expectReject(title, data, phrase) {
  const f = fixtures(data);
  await assert.rejects(() => voidStudentCollectibleAssessment(f.tx, {
    organizationId: 'ORG-A', collectibleId: 'ASSESS-1', reason: 'wrong charge',
  }), e => e.message.includes(phrase));
  assert.equal(f.updated(),0, `${title} mutated an assessment`);
  console.log('PASS', title);
}
(async () => {
  const f=fixtures();
  const result=await voidStudentCollectibleAssessment(f.tx, { organizationId:'ORG-A', collectibleId:'ASSESS-1', reason:'test reversal' });
  assert.equal(f.updated(),1);assert.equal(f.due.balanceDue,0);assert.match(f.due.status,/^Voided\|SID:/);assert.equal(result.amount,100);
  console.log('PASS Unpaid assessment safely voided');
  await expectReject('Active receipt requires OR reversal', {receipts:[{id:'R1',status:'Valid',paymentType:'Partial Payment'}]}, 'active payment receipt');
  await expectReject('Partially paid balance cannot be deleted', {due:{balanceDue:50}}, 'not fully restored');
  await expectReject('Historical active OR requires reversal', {links:[{receiptId:'R2'}],linkedReceipts:[{id:'R2',status:'Valid',paymentType:'Full Payment'}]}, 'active or unverified historical payments');
  await expectReject('Pending remittance blocks void', {pending:[{id:'P1'}]}, 'pending review');
  await expectReject('Duplicate assessments need reconciliation', {duplicates:[{id:'ASSESS-1',status:'Unpaid|SID:STU001|ITEM:Yearbook'}, {id:'ASSESS-2',status:'Unpaid|SID:STU001|ITEM:Yearbook'}]}, 'Duplicate student assessments');
  await expectReject('Already voided assessment blocked', {due:{status:'Voided|SID:STU001|ITEM:Yearbook',balanceDue:0}}, 'already been voided');
  await expectReject('Paid status blocked', {due:{status:'Paid|SID:STU001|ITEM:Yearbook',balanceDue:100}}, 'marked paid');
  console.log('All 8 accounting-safeguard tests passed. No database writes performed.');
})().catch(e=>{console.error(e);process.exitCode=1});
