/**
 * Project-wide SaaS placeholder neutralizer. READ-ONLY unless --apply.
 * Only modifies JSX/HTML `placeholder` attributes that contain Filamer or
 * identifiable person examples; it NEVER changes data, branding, acronyms,
 * domain configuration, user accounts, or non-placeholder content.
 * Run from project root:
 *   node scripts/neutralize-saas-placeholders.cjs
 *   node scripts/neutralize-saas-placeholders.cjs --apply
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const apply = process.argv.includes('--apply');
const roots = ['app', 'components', 'src', 'lib', 'public'];
const extensions = new Set(['.tsx', '.jsx', '.ts', '.js', '.html', '.htm']);
const skipDirs = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage', '.clear-placeholder-backup']);
const sensitive = /filamer|kenneth(?:\s+mark)?\s+bulquerin|\bbulquerin\b|kbulquerin/i;
// Accept quoted literals and string-literal JSX expressions, but not dynamic props.
const placeholder = /\bplaceholder\s*=\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|\{\s*(["'`])([^\r\n]*?)\3\s*\})/g;
const scan = [];
const residual = [];
function neutralize(value) {
  if (/\bfilamer\b/i.test(value) && /@/.test(value)) return /(?:e\.g\.|example)/i.test(value) ? 'e.g., officer@example.edu' : 'officer@example.edu';
  if (/@filamer\./i.test(value)) return /(?:e\.g\.|example)/i.test(value) ? 'e.g., officer@example.edu' : 'officer@example.edu';
  if (/kbulquerin/i.test(value) && !/@/.test(value)) return 'e.g., officer01';
  if (/\b(kenneth|bulquerin)\b/i.test(value)) {
    if (/@/.test(value)) return 'officer@example.edu';
    return 'e.g., Alex Rivera';
  }
  if (/filamer/i.test(value)) return 'e.g., Example University';
  return value;
}
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!skipDirs.has(entry.name)) walk(file); continue; }
    if (!entry.isFile() || !extensions.has(path.extname(entry.name).toLowerCase())) continue;
    const before = fs.readFileSync(file, 'utf8');
    const matches = [];
    const after = before.replace(placeholder, (whole, double, single, q, expression) => {
      const current = double ?? single ?? expression;
      if (!sensitive.test(current)) return whole;
      const next = neutralize(current);
      if (next === current) return whole;
      matches.push({ before: current, after: next });
      return double !== undefined ? `placeholder="${next}"` :
        single !== undefined ? `placeholder='${next}'` : `placeholder={${q}${next}${q}}`;
    });
    const rel = path.relative(root, file);
    if (matches.length) {
      scan.push({ file: rel, placeholders: matches });
      if (apply) {
        const backup = path.join(root, '.clear-placeholder-backup', rel);
        fs.mkdirSync(path.dirname(backup), { recursive: true });
        if (!fs.existsSync(backup)) fs.writeFileSync(backup, before);
        fs.writeFileSync(file, after);
      }
    }
    // Flag references elsewhere for human review; never change real content.
    let lineNo = 0;
    for (const line of after.split(/\r?\n/)) {
      lineNo++;
      if (sensitive.test(line) && !line.trim().startsWith('//')) residual.push({ file: rel, line: lineNo });
    }
  }
}
for (const name of roots) walk(path.join(root, name));
console.log(`CLEAR placeholder review — ${apply ? 'APPLIED' : 'DRY RUN (NO WRITES)'}`);
console.log(JSON.stringify({ modifiedFiles: scan.length, replacements: scan, otherReferencesForManualReview: residual }, null, 2));
if (!apply) console.log('No code changed. To update placeholder examples only, rerun with --apply. Backups are written under .clear-placeholder-backup/.');
