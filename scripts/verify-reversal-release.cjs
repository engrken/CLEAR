#!/usr/bin/env node
/** Static integration checks. NOT a substitute for a full Next.js build or transactional DB tests. */
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const base = path.join(root, 'app', 'department', '[department]', '(protected)');
const read = (sub) => fs.readFileSync(path.join(base, sub), 'utf8');
const checks = [
  ['void permission', read('void/actions.ts').includes('requireTabAccess("tab-void"')],
  ['liquidation void category', read('void/actions.ts').includes('category === "liquidations"')],
  ['liquidation returns CA reservation', read('void/actions.ts').includes('status: "Pending Liquidation"')],
  ['liquidation fund sufficiency check', read('void/actions.ts').includes('after.totalRemaining < -0.005')],
  ['voided audit ignored for CA cancellation', read('void/actions.ts').includes('const activeAudit = await tx.audit.findFirst')],
  ['remittance status linked to OR reversal', read('void/actions.ts').includes('REVERSE_APPROVED_REMITTANCE')],
  ['atomic financial reversal', read('void/actions.ts').includes('Prisma.TransactionIsolationLevel.Serializable')],
  ['liquidation permission UI', read('liquidations/page.tsx').includes('requireTabAccess("tab-void"')],
  ['remittance permission UI', read('remittances/page.tsx').includes("requireTabAccess('tab-void'")],
  ['advance permission UI', read('advances/page.tsx').includes('requireTabAccess("tab-void"')],
  ['cash advance history', read('advances/CashAdvanceHistory.tsx').includes('Cash Advance History')],
  ['avoid hardcoded liquidation semester list', !read('liquidations/actions.ts').includes('["1st Sem", "2nd Sem", "Summer"]')],
  ['re-liquidate after audited reversal', read('liquidations/actions.ts').includes('status: { contains: "VOID"')],
  ['read-only past liquidation history', read('liquidations/LiquidationHistory.tsx').includes('reverseAudit(audit)')],
];
let failures=0;
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}`);
  if (!passed) failures++;
}
console.log(`${checks.length - failures}/${checks.length} source checks passed.`);
if (failures) process.exit(1);
