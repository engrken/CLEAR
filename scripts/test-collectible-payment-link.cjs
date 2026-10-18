/* Offline payment identity checks. Does NOT connect to Neon/Postgres. */
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const ts=require('typescript');
const p=path.resolve(__dirname,'../app/department/[department]/(protected)/collectibles/due-link.ts');
const compiled=ts.transpileModule(fs.readFileSync(p,'utf8'),{fileName:p,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const mod={exports:{}};new Function('require','module','exports',compiled)(require,mod,mod.exports);
const {applyPaymentToStudentCollectibles: post}=mod.exports;
function row(id,category='Merchandise',balance=100){return {id,organizationId:'T',academicYear:'AY',term:'Term',category,balanceDue:balance,status:'Unpaid|SID:STU01|ITEM:Shirt'};}
function fixture(rows){let mutations=0;const tx={collectible:{async findMany(){return rows;},async updateMany({where,data}){
 const r=rows.find(x=>x.id===where.id);if(!r||r.balanceDue!==where.balanceDue||r.status!==where.status)return {count:0};mutations++;Object.assign(r,data);return {count:1};
}}};return {tx,mutations:()=>mutations};}
const args={organizationId:'T',academicYear:'AY',term:'Term',studentId:'STU01',category:'Merchandise',itemDescription:'Shirt',amountCents:2500};
(async()=>{
 let f=fixture([row('A','Events'),row('B','Merchandise')]);
 assert.equal(await post(f.tx,args),2500);assert.equal(f.tx.collectible?0:1,0);assert.equal(f.mutations(),1);
 console.log('PASS matching category only (same-named fee in other category untouched)');
 f=fixture([row('A','Events')]);assert.equal(await post(f.tx,args),0);assert.equal(f.mutations(),0);
 console.log('PASS unassessed category cannot change an unrelated receivable');
 f=fixture([row('A','Merchandise'),row('B','Merchandise')]);await assert.rejects(()=>post(f.tx,args),/Multiple active assessments/);assert.equal(f.mutations(),0);
 console.log('PASS ambiguous double assessment cannot be partially settled');
 f=fixture([row('A','Merchandise',10)]);assert.equal(await post(f.tx,args),1000);assert.equal(f.tx.collectible?0:1,0);assert.equal(f.mutations(),1);
 console.log('PASS payment reduces due without going below zero');
 console.log('All 4 payment identity tests passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
