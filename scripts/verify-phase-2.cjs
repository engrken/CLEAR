const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const all = [
'lib/academic-periods.ts',
'lib/academic-period-guard.ts',
'app/department/[department]/layout.tsx',
'app/department/[department]/TopHeader.tsx',
'app/department/[department]/(protected)/setup/AcademicPeriodSettings.tsx',
'app/department/[department]/(protected)/setup/academic-period-actions.ts',
'app/department/[department]/(protected)/setup/page.tsx',
'app/department/[department]/(protected)/setup/SetupClient.tsx',
'app/department/[department]/(protected)/setup/actions.ts',
'app/department/[department]/(protected)/setup/collections/page.tsx',
'app/department/[department]/(protected)/realign/ledger.ts',
'app/department/[department]/(protected)/realign/page.tsx',
'app/department/[department]/(protected)/realign/actions.ts',
'app/department/[department]/(protected)/realign/RealignManager.tsx',
'app/department/[department]/(protected)/liquidations/actions.ts',
'app/department/[department]/(protected)/collections/page.tsx',
'app/department/[department]/(protected)/collections/actions.ts',
'app/department/[department]/(protected)/penalties/actions.ts',
'app/department/[department]/(protected)/advances/actions.ts',
'app/department/[department]/(protected)/collectibles/actions.ts',
'app/department/[department]/(protected)/remittances/actions.ts',
'app/department/[department]/(protected)/cashier-remittance/actions.ts',
];
for (const file of all) {
 const s=fs.readFileSync(path.join(process.cwd(),file),'utf8');
 const result=ts.transpileModule(s,{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2022}});
 const errors=result.diagnostics||[];
 if(errors.length){console.error(file,errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')));process.exitCode=1;}
}
if(!process.exitCode)console.log(`PASS: Syntax/transpilation for ${all.length} TypeScript/TSX files.`);
