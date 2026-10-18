#!/usr/bin/env node
// CLI-only helper. No DB operations. Use --apply after reviewing the preview.
const fs = require('node:fs');
const path = require('node:path');
const schema = path.resolve(process.cwd(), 'prisma/schema.prisma');
const fragment = path.resolve(__dirname, '../prisma/CLEAR-period-models.prisma.fragment');
if (!fs.existsSync(schema)) throw new Error(`Not found: ${schema}. Run from project root.`);
if (!fs.existsSync(fragment)) throw new Error(`Not found: ${fragment}. Copy prisma/CLEAR-period-models.prisma.fragment from ZIP.`);
const old = fs.readFileSync(schema, 'utf8');
if (!/model\s+AcademicPeriodConfig\s*\{/.test(old)) throw new Error('AcademicPeriodConfig must exist from the earlier Phase 2 release. Stop and configure it first.');
const models = ['AcademicPeriodTransition','ArrearPaymentLink'];
const present = models.filter(name => new RegExp(`\\bmodel\\s+${name}\\s*\\{`).test(old));
if (present.length > 0 && present.length < models.length) throw new Error('Only one transition model is present: reconcile schema manually, do not append a partial duplicate.');
const missing = present.length === 0;
let proposed = old;
if (missing) {
  // Add Prisma inverse relation fields; existing fields and records are untouched.
  if (!/model\s+Organization\s*\{/.test(proposed) || !/model\s+Collection\s*\{/.test(proposed)) {
    throw new Error('Organization or Collection model not found; review schema manually.');
  }
  if (!/\bacademicPeriodTransitions\s+AcademicPeriodTransition\[\]/.test(proposed)) {
    proposed = proposed.replace(/(model\s+Organization\s*\{)/, '$1\n  academicPeriodTransitions AcademicPeriodTransition[]\n  arrearPaymentLinks ArrearPaymentLink[]');
  }
  if (!/\barrearPaymentLink\s+ArrearPaymentLink\?/.test(proposed)) {
    proposed = proposed.replace(/(model\s+Collection\s*\{)/, '$1\n  arrearPaymentLink ArrearPaymentLink?');
  }
  proposed = proposed.trimEnd() + '\n\n' + fs.readFileSync(fragment, 'utf8').trim() + '\n';
}
console.log(`Existing models: ${present.length ? present.join(', ') : '(none)'}`);
console.log(`Action: ${missing ? 'Append AcademicPeriodTransition and ArrearPaymentLink' : 'Already present; no change'}`);
if (!process.argv.includes('--apply')) { console.log('PREVIEW ONLY. Add --apply to modify the Prisma schema.'); process.exit(0); }
if (!missing) { console.log('No changes required.'); process.exit(0); }
const backup = `${schema}.before-period-transition-${Date.now()}.bak`;
fs.copyFileSync(schema, backup, fs.constants.COPYFILE_EXCL);
fs.writeFileSync(schema, proposed);
console.log(`Schema updated. Backup: ${backup}`);
console.log('NEXT: npx prisma format && npx prisma validate && npx prisma generate');
console.log('Do NOT run prisma migrate dev against the drifted Neon database. Use reviewed SQL from scripts/clear-period-upgrade.sql in a Neon staging branch.');
