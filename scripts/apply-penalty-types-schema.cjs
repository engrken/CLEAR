#!/usr/bin/env node
// Does NOT connect to PostgreSQL. Applies only missing Prisma model/field declarations.
// Preview by default; --apply writes a timestamped .bak and changes prisma/schema.prisma.
const fs = require('node:fs');
const path = require('node:path');
const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
const fragmentPath = path.resolve(__dirname, '../prisma/CLEAR-penalty-events.prisma.fragment');
if (!fs.existsSync(schemaPath)) throw Error('Run in the CLEAR project root: prisma/schema.prisma not found.');
if (!fs.existsSync(fragmentPath)) throw Error('Missing prisma/CLEAR-penalty-events.prisma.fragment.');
let source = fs.readFileSync(schemaPath, 'utf8');
const original = source;
function addInsideModel(name, field, type) {
  const start = new RegExp(`(^model\\s+${name}\\s*\\{)`, 'm');
  if (!start.test(source)) throw Error(`Model ${name} missing; stop and check schema.`);
  const model = source.match(new RegExp(`model\\s+${name}\\s*\\{[\\s\\S]*?\\n\\}`, 'm'));
  if (!model) throw Error(`Model ${name} has an unexpected format; edit manually.`);
  const own = model[0];
  const existing = own.match(new RegExp(`^\\s*${field}\\s+(\\S+)`, 'm'));
  if (existing) {
    if (existing[1] !== type) throw Error(`Unexpected ${name}.${field} type ${existing[1]}; reconcile manually.`);
    return;
  }
  source = source.replace(start, `$1\n  ${field} ${type}`);
}
addInsideModel('Penalty', 'penaltyType', 'String');
// @default is required for historical rows on Neon; do not overwrite existing fields.
const penaltyBody = source.match(/model\s+Penalty\s*\{[\s\S]*?\n\}/)?.[0] || '';
if (!/^\s*penaltyType\s+String\s+@default\("SERVICE_ELIGIBLE"\)/m.test(penaltyBody)) {
  if (/^\s*penaltyType\s+String\s*$/m.test(penaltyBody)) {
    source = source.replace(/(model\s+Penalty\s*\{[\s\S]*?\bpenaltyType\s+String)(\s*\n)/, '$1 @default("SERVICE_ELIGIBLE")$2');
  } else throw Error('Penalty.penaltyType differs from expected default; edit manually.');
}
addInsideModel('Penalty', 'assessedAmount', 'Float?');
addInsideModel('Penalty', 'settlementEvents', 'PenaltySettlementEvent[]');
addInsideModel('Collection', 'penaltySettlementEvents', 'PenaltySettlementEvent[]');
addInsideModel('Organization', 'penaltySettlementEvents', 'PenaltySettlementEvent[]');
if (!/model\s+PenaltySettlementEvent\s*\{/.test(source)) {
  source = source.trimEnd() + '\n\n' + fs.readFileSync(fragmentPath, 'utf8').trim() + '\n';
} else {
  const old = source.match(/model\s+PenaltySettlementEvent\s*\{[\s\S]*?\n\}/)?.[0] || '';
  for(const required of ['penaltyRecordId', 'receiptId', 'method', 'amount', 'accountingAY', 'balanceBefore']) {
    if (!new RegExp(`\\b${required}\\s`).test(old)) throw Error('Existing PenaltySettlementEvent is incomplete; reconcile manually.');
  }
}
console.log('Status: ' + (original === source ? 'Prisma schema already aligned.' : 'New Prisma fields/model needed.'));
if (!process.argv.includes('--apply')) {console.log('PREVIEW ONLY. Add --apply after reviewing and backing up.'); process.exit(0);}
if (original === source) process.exit(0);
const backup = schemaPath + '.before-penalty-types-' + Date.now() + '.bak';
fs.copyFileSync(schemaPath, backup, fs.constants.COPYFILE_EXCL);
fs.writeFileSync(schemaPath, source);
console.log('Updated schema.prisma. Backup: ' + backup);
console.log('NEXT: npx prisma format && npx prisma validate && npx prisma generate. Do not reset Neon.');
