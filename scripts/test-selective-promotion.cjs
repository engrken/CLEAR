/** Offline action-level tests. Does not connect to CLEAR PostgreSQL. */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'department', '[department]', '(protected)', 'students', 'actions.ts'), 'utf8');
const compiled = ts.transpileModule(source, { fileName: 'actions.ts', compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const A = 'school-A', B = 'school-B';
let records, logs, noPermission, forceConflict;
const reset = () => {
  noPermission = false; forceConflict = false; logs = [];
  records = [
    { id:'s1', organizationId:A, studentId:'A-001', yearLevel:'1st Year' },
    { id:'s2', organizationId:A, studentId:'A-002', yearLevel:'2nd Year' },
    { id:'s3', organizationId:A, studentId:'A-003', yearLevel:'4th Year' },
    { id:'s4', organizationId:B, studentId:'B-001', yearLevel:'1st Year' },
    { id:'s5', organizationId:A, studentId:'A-005', yearLevel:'Graduated / Alumni' },
  ];
};
reset();
const prisma = {
  organization: { findUnique: async ({where}) => where.subdomain==='tenant-a' ? {id:A} : null },
  $transaction: async (callback) => {
    // Simulate transaction atomically: updates rolled back if an action throws.
    const next=records.map(s=>({...s})); const nextLogs = [];
    const result = await callback({
      student:{
        findMany:async ({where})=>next.filter(s=>s.organizationId===where.organizationId && where.id.in.includes(s.id)).map(({id,studentId,yearLevel})=>({id,studentId,yearLevel})),
        updateMany:async ({where,data}) => {
          if(forceConflict) return {count:0};
          const row=next.find(s=>s.id===where.id && s.organizationId===where.organizationId && s.yearLevel===where.yearLevel);
          if(!row) return {count:0}; row.yearLevel=data.yearLevel; return {count:1};
        },
      },
      systemLog:{create:async ({data})=>nextLogs.push(data)},
    });
    records=next; logs.push(...nextLogs); return result;
  },
};
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if(id==='@prisma/client') return {Prisma:{TransactionIsolationLevel:{Serializable:'Serializable'}}};
  if(id==='@/lib/prisma') return {prisma};
  if(id==='@/lib/permissions') return {requireTabAccess: async (tab, dept)=>{
    if(noPermission) throw Error('Unauthorized');
    assert.equal(tab,'tab-students'); assert.equal(dept,'tenant-a');
    return {organizationId:A,name:'Test Officer'};
  }};
  if(id==='next/cache') return {revalidatePath:()=>{}};
  return originalRequire.apply(this,arguments);
};
const moduleForTest = new Module('test-promotion', module);
try { moduleForTest._compile(compiled,'test-promotion.js'); }
finally { Module.prototype.require = originalRequire; }
const promote = moduleForTest.exports.promoteSelectedYearLevels;
(async () => {
  let res=await promote('tenant-a','malicious-client-org-id',['s1','s3']);
  assert.equal(res.promoted,2);
  assert.equal(records.find(r=>r.id==='s1').yearLevel,'2nd Year');
  assert.equal(records.find(r=>r.id==='s2').yearLevel,'2nd Year','unselected student unchanged');
  assert.equal(records.find(r=>r.id==='s3').yearLevel,'Graduated / Alumni');
  assert.equal(records.find(r=>r.id==='s4').yearLevel,'1st Year','other tenant unchanged');
  assert.equal(logs.length,1);
  assert.equal(logs[0].action,'PROMOTE_SELECTED_YEAR_LEVELS');
  console.log('PASS: Only selected student IDs change; audit log written');

  reset(); await assert.rejects(promote('tenant-a',A,['s1','s4']),/outside this organization/);
  assert.equal(logs.length,0); assert.equal(records.find(r=>r.id==='s1').yearLevel,'1st Year');
  console.log('PASS: Cross-tenant IDs cause atomic rejection');

  reset(); await assert.rejects(promote('tenant-a',A,['s1','s5']),/Cannot promote/);
  assert.equal(logs.length,0); assert.equal(records.find(r=>r.id==='s1').yearLevel,'1st Year');
  console.log('PASS: Graduated/unassigned selection rejects entire batch');

  reset(); await assert.rejects(promote('tenant-a',A,[]),/Select at least one/);
  await assert.rejects(promote('tenant-a',A,['s1','s1']),/duplicate/);
  console.log('PASS: Empty or duplicate selections rejected');

  reset(); forceConflict=true;
  await assert.rejects(promote('tenant-a',A,['s1']),/changed during promotion/);
  assert.equal(logs.length,0); assert.equal(records.find(r=>r.id==='s1').yearLevel,'1st Year');
  console.log('PASS: Concurrent row change causes atomic rejection');

  reset(); noPermission=true;
  await assert.rejects(promote('tenant-a',A,['s1']),/Unauthorized/);
  assert.equal(logs.length,0);
  console.log('PASS: Tab permission enforced');
  console.log('All selective year-level promotion tests passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
