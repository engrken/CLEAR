#!/usr/bin/env node
/** Offline/static checks. No network or database writes. */
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript'); } catch { console.error('Install TypeScript to run this verification: npm install'); process.exit(1); }
const root = process.cwd();
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const files = [
 'app/dashboard/provisions/actions.ts',
 'app/dashboard/provisions/MasterProvisionForm.tsx',
 'app/department/[department]/(protected)/setup/page.tsx',
];
function assert(ok, explanation) { if (!ok) { console.error('FAIL', explanation);process.exitCode=1; } else console.log('PASS',explanation); }
for(const f of files) {
 const source = read(f);
 const result=ts.transpileModule(source,{fileName:f,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});
 assert((result.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length===0,`${f} TS/TSX syntax`);
}
const action=read(files[0]), form=read(files[1]), setup=read(files[2]);
assert(action.includes('await tx.academicPeriodConfig.create('),'Calendar initialized inside provisioning transaction');
assert(action.indexOf('await tx.academicPeriodConfig.create(')>action.indexOf('await tx.organization.create('),'Organization created before calendar');
assert(action.includes('activeAy: initialAcademicYear, activeTerm: initialTerm'),'Tenant starts in configured initial term');
assert(action.includes('academicYearStart(initialAcademicYear)')&&action.includes('isCalendarMode('),'Calendar and academic-year validated on server');
assert(action.includes('await verifiedSuperAdminEmail()'),'Super Admin guard retained');
assert(form.includes('name="initialAcademicYear"')&&form.includes('name="calendarMode"'),'Calendar selection required in provisioning UI');
assert(form.includes('Open Initial Tenant Setup'),'Provisioning success links to setup');
assert(setup.includes('First-Time Tenant Setup')&&setup.includes('Setup Collection Fees'),'Tenant setup checklist includes fee setup');
assert(setup.includes('fundName.toLowerCase() !== PENALTY_FUND_NAME.toLowerCase()'),'Penalty Fund not accepted as general starting fee fund');
console.log(process.exitCode?'Some checks failed.':'PASS: All onboarding static checks.');
