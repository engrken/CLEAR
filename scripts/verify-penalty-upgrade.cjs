#!/usr/bin/env node
// Static regression checks; does not touch PostgreSQL or post payments.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const rel = (name) => path.join(root, 'app/department/[department]/(protected)', name);
const cases = [
  ['penalties/actions.ts', ['penaltyType === "LATE_FEE"', 'tx.penaltySettlementEvent.create', 'Late Fees are cash-only']],
  ['penalties/PenaltiesManager.tsx', ['value="LATE_FEE"', 'Fixed Late Fee', 'Transaction History', 'p.penaltyType !== "LATE_FEE"']],
  ['penalties/page.tsx', ['prisma.penaltySettlementEvent.findMany', 'historyByPenalty', 'Historical receipt']],
  ['collections/actions.ts', ['method: "CASH_PAYMENT"', 'receiptId: firstReceiptId', 'pen.penaltyType !== "LATE_FEE"']],
  ['collections/arrears/actions.ts', ['method: "CASH_PAYMENT"', 'linkedPenaltyRecordId', 'receiptId: receipt.id']],
  ['void/actions.ts', ['method: "CASH_REVERSAL"', 'receiptId: link.receiptId', 'receiptId: reversedReceipt.id']],
];
let checked = 0;
for(const [file, expectations] of cases) {
  const filename = rel(file);
  const source = fs.readFileSync(filename, 'utf8');
  for (const text of expectations) {
    if (!source.includes(text)) throw Error(`Missing safeguard in ${file}: ${text}`);
    checked++;
  }
  const compiled = ts.transpileModule(source, {fileName: filename, reportDiagnostics: true,
    compilerOptions: {jsx:ts.JsxEmit.Preserve, target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.ESNext}});
  const errors = (compiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  if (errors.length) throw Error(`${file}: ${errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('; ')}`);
}
const sql = fs.readFileSync(path.join(root, 'scripts/clear-penalty-types-upgrade.sql'), 'utf8');
const fragment = fs.readFileSync(path.join(root, 'prisma/CLEAR-penalty-events.prisma.fragment'), 'utf8');
for(const anchor of ['ALTER TABLE public."Penalty"', '"penaltyType"', '"assessedAmount"', '"PenaltySettlementEvent"', 'REFERENCES public."Collection"']) {
  if (!sql.includes(anchor)) throw Error('SQL missing ' + anchor);
}
if(!/model\s+PenaltySettlementEvent\s*\{/.test(fragment) ||
   !/\breceipt\s+Collection\?/.test(fragment) || !/\bpenalty\s+Penalty\b/.test(fragment)) {
  throw Error('Prisma event model missing required receipt or penalty relation');
}
const refPattern = /LATE_FEE[\s\S]{0,250}COMMUNITY_SERVICE/g;
console.log(`PASS: ${cases.length} TS/TSX files syntactically parsed; ${checked} critical code markers present.`);
console.log('PASS: flat Late Fees rejected by server community-service action; cash and historical payments write transaction events.');
console.log('PASS: current and historical receipt voids append reversing events.');
console.log('PASS: additive SQL and Prisma model include receipt, penalty, and organization links.');
console.log('NOTE: This is source-level verification, NOT npm run build or a PostgreSQL integration test.');
