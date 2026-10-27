import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildIssuedReceipts, filterIssuedReceipts } from '../app/department/[department]/(protected)/collections/history/receipt-grouping.ts';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const filter = exactOr => ({ q:'', exactOr, status:'all', category:'', description:'',
  paymentType:'', from:'', to:'', inconsistentOnly:false });

const row = (base, code, n, academicYear='A.Y. 2026 - 2027') => ({
  id: code, orNumber: code, studentId:'synthetic-student', studentName:'Synthetic',
  student: { studentId: 'SYN-0001' }, academicYear, term:'1st Sem',
  date:'2026-10-20T00:00:00.000Z', timestamp:'2026-10-20T00:00:00.000Z',
  encodedBy:'Synthetic', category:'Membership', itemDescription:'Package allocation',
  paymentType:'Full Payment', status:'Valid', amountPaid:n,
});

test('exact OR with package suffix resolves complete one-receipt group', () => {
  const allocations=[row('OR-100','OR-100',50),row('OR-100','OR-100-P02',30),
    row('OR-100','OR-100-P03',20),row('OR-101','OR-101',15)];
  const issued=buildIssuedReceipts(allocations);
  assert.equal(issued.length,2);
  for(const input of ['OR-100','or-100-p02',' OR-100-P03 ']){
    const found=filterIssuedReceipts(issued,filter(input));
    assert.equal(found.length,1,input);
    assert.equal(found[0].orNumber,'OR-100');
    assert.equal(found[0].count,3);
    assert.equal(found[0].total,100);
  }
});

test('large grouped synthetic source preserves actual OR groups before pagination', () => {
  const rows=[];
  for(let i=0;i<1000;i++){
    const base='OR-'+String(i).padStart(6,'0');
    rows.push(row(base,base,1),row(base,base+'-P02',2));
  }
  const grouped=buildIssuedReceipts(rows);
  assert.equal(grouped.length,1000);
  assert.ok(grouped.every(x=>x.count===2&&x.total===3));
  const pages=Array.from({length:40},(_,i)=>grouped.slice(i*25,(i+1)*25));
  assert.equal(pages.flat().length,1000);
  assert.equal(new Set(pages.flat().map(x=>x.key)).size,1000);
});

test('web P2 instrumentation is opt-in and contains only timing/aggregate metadata',()=>{
  const page=read('app/department/[department]/(protected)/collections/history/page.tsx');
  assert.match(page,/requireTabAccess\("tab-payment", slug\)/);
  assert.match(page,/CLEAR_PROFILE_RECEIPT_HISTORY === '1'/);
  assert.match(page,/dbMs: Math\.round\(queryDurationMs\)/);
  assert.match(page,/groupingMs: Math\.round/);
  assert.match(page,/buildIssuedReceipts\(allocationLines\)/);
  assert.match(page,/matched\.slice\(/);
  assert.match(page,/baseOfficialReceiptNumber\(get\(query\.or, 50\)\)/);
  const log=page.match(/console\.info\('\[clear\/perf\/receipt-history\]'[\s\S]*?\}\);/);
  assert.ok(log,'Must emit only non-sensitive profiling fields');
  for(const secret of ['studentName','orNumber','organizationId','email','token','amountPaid','query','slug']){
    assert.doesNotMatch(log[0],new RegExp('\\b'+secret+'\\b','i'));
  }
});
