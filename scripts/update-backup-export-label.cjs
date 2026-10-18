/**
 * Non-destructive, idempotent UI-label patch for existing CLEAR Setup pages.
 * Run at CLEAR project root with:
 *     node scripts/update-backup-export-label.cjs
 * Changes only the backup export description/button text in setup/page.tsx.
 * Avoids replacing the full page when local Setup features have evolved.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const target = path.join(root, 'app', 'department', '[department]', '(protected)', 'setup', 'page.tsx');
if (!fs.existsSync(target)) {
  console.error(`ERROR: File not found: ${target}`);
  process.exit(1);
}
const original = fs.readFileSync(target, 'utf8');
let updated = original;
const substitutions = [
  ['Export Full Backup (.json)', 'Export Encrypted Backup'],
  [
    'Download a complete JSON snapshot of this department&apos;s\n                  records. Restricted to active administrators.',
    'Download an encrypted, authenticated backup of this department&apos;s\n                  records. Restricted to active administrators.',
  ],
  [
    "Download a complete JSON snapshot of this department's records. Restricted to active administrators.",
    "Download an encrypted, authenticated backup of this department's records. Restricted to active administrators.",
  ],
];

for (const [oldText, newText] of substitutions) {
  if (updated.includes(oldText)) {
    updated = updated.replace(oldText, newText);
  }
}
if (updated === original) {
  if (original.includes('Export Encrypted Backup')) {
    console.log('No changes needed: the export button already has the secure label.');
    process.exit(0);
  }
  console.error('No expected label found. Please inspect setup/page.tsx and edit the label manually.');
  process.exit(1);
}
if (updated.includes('Export Full Backup (.json)')) {
  console.error('Unexpected duplicate legacy label; no changes were written.');
  process.exit(1);
}
const backup = target + '.before-backup-label-fix.bak';
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);
fs.writeFileSync(target, updated, 'utf8');
console.log('Updated secure backup export label.');
console.log('Source backup:', backup);
