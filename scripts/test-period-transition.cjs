/* Safe offline tests: reads source and uses synthetic objects. No database/network access. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
const load = (f,mocks={}) => {
  const p = path.resolve(root,f);
  const source = fs.readFileSync(p,'utf8');
  const output = ts.transpileModule(source,{fileName:p,reportDiagnostics:true,compilerOptions:{
    target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,
  }});
  const syntaxErrors=(output.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error);
  assert.equal(syntaxErrors.length,0,`${f}: ${syntaxErrors.map(x=>ts.flattenDiagnosticMessageText(x.messageText,' '))}`);
  const exports={};const module={exports};
  const fakeRequire = id => {
    if(id in mocks) return mocks[id];
    if(id==='@prisma/client')return {};
    throw new Error(`Unmocked runtime import ${id} in ${f}`);
  };
  new Function('module','exports','require',output.outputText)(module,exports,fakeRequire);
  return module.exports;
};
(async()=>{
  const periods=load('lib/academic-periods.ts');
  const a='A.Y. 2026 - 2027', b='A.Y. 2027 - 2028';
  assert.deepEqual(periods.periodsFor({mode:'FullYear',includeSummer:false}),['Full Year']);
  assert.deepEqual(periods.periodsFor({mode:'Trimester',includeSummer:false}),['1st Trimester','2nd Trimester','3rd Trimester']);
  assert.deepEqual(periods.periodsFor({mode:'Semester',includeSummer:true}),['1st Sem','2nd Sem','Summer']);
  assert.deepEqual(periods.followingPeriod(a,'1st Sem',{[a]:{mode:'Semester',includeSummer:false}}),{ay:a,term:'2nd Sem'});
  assert.deepEqual(periods.followingPeriod(a,'2nd Sem',{[a]:{mode:'Semester',includeSummer:false},[b]:{mode:'Trimester',includeSummer:false}}),{ay:b,term:'1st Trimester'});
  assert.deepEqual(periods.followingPeriod(a,'Full Year',{[a]:{mode:'FullYear',includeSummer:false},[b]:{mode:'Semester',includeSummer:false}}),{ay:b,term:'1st Sem'});
  assert.deepEqual(periods.followingPeriod(a,'Summer',{[a]:{mode:'Semester',includeSummer:true},[b]:{mode:'FullYear',includeSummer:false}}),{ay:b,term:'Full Year'});
  const arrears=load('lib/student-arrears.ts',{
    '@/lib/academic-periods':periods,
    '@/app/department/[department]/(protected)/collectibles/due-link': {
      decodeStudentDue:status=>{ const s=String(status);const m=s.match(/\|SID:([^|]+)\|ITEM:([^|]+)/);return m?{studentId:m[1],itemDescription:m[2]}:null;},
      activeCollectibleDue:x=>x.balanceDue>0&&!/VOID|PAID|CANCEL/.test(x.status)
    },
  });
  const years={[a]:{mode:'Semester',includeSummer:false},[b]:{mode:'Trimester',includeSummer:false}};
  assert.equal(arrears.olderThan(a,'1st Sem',b,'1st Trimester',years),true);
  assert.equal(arrears.olderThan(b,'1st Trimester',b,'1st Trimester',years),false);
  assert.equal(arrears.olderThan(b,'2nd Trimester',b,'1st Trimester',years),false);
  const fakeDb={
    academicPeriodConfig:{findMany:async()=>Object.entries(years).map(([academicYear,v])=>({...v,academicYear}))},
    penalty:{findMany:async()=>[
      {id:'P1',academicYear:a,term:'1st Sem',studentId:'S-1',activity:'Late Fee',fineAmount:100,status:'Unsettled'},
      {id:'P2',academicYear:a,term:'1st Sem',studentId:'S-1',activity:'Settled',fineAmount:0,status:'Settled'},
    ]},
    collectible:{findMany:async()=>[
      {id:'C1',academicYear:a,term:'1st Sem',category:'Activity',balanceDue:75,status:'Unpaid|SID:S-1|ITEM:Trip'},
      {id:'C2',academicYear:a,term:'1st Sem',category:'Activity',balanceDue:20,status:'Unpaid|SID:S-2|ITEM:Trip'},
    ]},
  };
  const debts=await arrears.listHistoricalDebts(fakeDb,'ORG',b,'1st Trimester','S-1');
  assert.equal(debts.length,2);
  assert.deepEqual(debts.map(x=>x.balanceDue).sort((x,y)=>x-y),[75,100]);
  assert.ok(debts.every(x=>x.originAY===a && x.studentId==='S-1'));
  const guard=load('lib/academic-period-guard.ts',{'./academic-periods':periods});
  const guardDb={academicPeriodConfig:fakeDb.academicPeriodConfig,academicPeriodTransition:{findFirst:async()=>({destinationAY:b,destinationTerm:'1st Trimester'})}};
  await assert.rejects(()=>guard.assertAcademicPeriod(guardDb,'ORG',a,'1st Sem'),/closed/i);
  guardDb.academicPeriodTransition.findFirst=async()=>null;
  await guard.assertAcademicPeriod(guardDb,'ORG',b,'1st Trimester');
  await assert.rejects(()=>guard.assertAcademicPeriod(guardDb,'ORG',b,'1st Sem'),/not enabled/i);
  const provisioning=fs.readFileSync(path.join(root,'app/dashboard/actions.ts'),'utf8');
  for(const key of ['initialAcademicYear,','calendarMode,','includeSummer,'])assert.ok(provisioning.includes(key),`Missing provisioning field ${key}`);
  const rollover=fs.readFileSync(path.join(root,'app/department/[department]/(protected)/realign/actions.ts'),'utf8');
  assert.ok(rollover.includes('transfer?.id || "ZERO-BALANCE"'),'Zero balance rollover must not dereference null transfer');
  const shared=fs.readFileSync(path.join(root,'app/department/[department]/actions.ts'),'utf8');
  assert.ok(shared.includes('Legacy payment posting is disabled'));
  console.log('PASS: 16 synthetic calendar, cross-period arrears, closed-period, legacy-action and provisioning checks.');
})().catch(e=>{console.error(e);process.exitCode=1});
