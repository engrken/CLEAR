/* Read-only static audit for native dialog calls under app/. Run in project root. */
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript'); } catch {
  console.error('Install project dependencies first: npm install (TypeScript is required)');
  process.exit(2);
}
const root = path.join(process.cwd(), 'app');
if (!fs.existsSync(root)) { console.error('Run this script from the CLEAR project root.'); process.exit(2); }
const remaining = [];
let checked = 0;
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filename = path.join(dir, entry.name);
    if (entry.isDirectory()) { scan(filename); continue; }
    if (!filename.endsWith('.tsx') && !filename.endsWith('.ts')) continue;
    checked++;
    const source = ts.createSourceFile(filename, fs.readFileSync(filename,'utf8'), ts.ScriptTarget.Latest, true, filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    function visit(node) {
      if (ts.isCallExpression(node) && /^(?:window\.)?(?:alert|confirm|prompt)$/.test(node.expression.getText(source))) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        remaining.push(`${path.relative(process.cwd(), filename)}:${line}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
scan(root);
console.log(`Reviewed ${checked} app source files.`);
if (remaining.length) { console.error('Native dialogs remain:\n' + remaining.join('\n')); process.exitCode = 1; }
else console.log('PASS: No native browser alert/confirm/prompt calls in app/.');
