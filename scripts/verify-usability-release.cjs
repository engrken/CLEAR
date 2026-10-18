// Offline / no database writes. Run from the CLEAR repository root.
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript'); } catch { console.error('TypeScript is needed for syntax verification. Run npm install first.'); process.exit(2); }
const root = process.cwd();
const mod = 'app/department/[department]/(protected)';
const checks = [
  ['void/page.tsx', ['requireTabAccess', 'organizationId: organization.id', 'prisma.collection.count', 'prisma.penalty.count', 'prisma.collectible.count', 'prisma.cashAdvance.count', 'pageSize', 'query={q}', 'decodeStudentDue', 'studentName', 'orderBy']],
  ['void/VoidClient.tsx', ['handleSearch', 'buildUrl', 'q', 'Rows per page', 'setSearchText(\'\')', 'router.replace', 'submitVoid']],
  ['students/StudentsClient.tsx', ['promoteSelectedYearLevels', 'clearRosterSearchAfterSuccess', 'updateQuery({ search: "", page: "1" })']],
  ['penalties/PenaltiesManager.tsx', ['setLogSearch("")', 'setSearchQuery("")', 'settlePenaltyCommunityService']],
  ['collectibles/CollectiblesManager.tsx', ['setDueSearch("")', 'setLogSearch("")', 'setLogPage(1)', 'voidCollectibleAssessment']],
  ['advances/CashAdvanceHistory.tsx', ['setSearch("")', 'executeVoidTransaction']],
  ['collections/arrears/ArrearsPaymentClient.tsx', ['setOrNumber("")', 'router.replace(', 'Historical Payment Recorded']],
];
let passed=0;
for (const [short, needles] of checks) {
  const file=path.join(root,mod,short);
  if(!fs.existsSync(file)) {console.error('MISSING:',short);process.exitCode=1;continue;}
  const source=fs.readFileSync(file,'utf8');
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  if(ast.parseDiagnostics.length) {
    console.error('PARSE ERROR:',short,ast.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')));
    process.exitCode=1;continue;
  }
  const missing=needles.filter(x=>!source.includes(x));
  if(missing.length) {console.error('INCOMPLETE:',short,missing);process.exitCode=1;continue;}
  console.log('PASS:',short, 'syntax and implementation guard checks');
  passed++;
}
const client=fs.readFileSync(path.join(root,mod,'void/VoidClient.tsx'),'utf8');
const server=fs.readFileSync(path.join(root,mod,'void/page.tsx'),'utf8');
if (/executeVoidTransaction\(/.test(server) || !client.includes('executeVoidTransaction({')) {
  console.error('FAIL: transaction should remain in the guarded VoidClient action');process.exitCode=1;
} else if (!server.includes('academicYear: ay, term') || !server.includes("await requireTabAccess('tab-void', slug)")) {
  console.error('FAIL: period or permissions filter missing');process.exitCode=1;
} else console.log('PASS: server-side period/tenant/permission boundaries retained');
if (!process.exitCode) console.log(`All ${passed} modified TSX files passed the offline checks. This is not a full Next.js build or PostgreSQL transaction test.`);
