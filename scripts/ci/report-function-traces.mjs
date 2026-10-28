// Non-mutating CI audit of Next.js server output traces.
// This is an approximation of files referenced by each traced function,
// NOT the Vercel provider's actual billed Function Storage bytes.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';

const root = resolve('.next');
const paths = [];
function scan(dir) {
  if (!existsSync(dir)) return;
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, item.name);
    if (item.isDirectory()) scan(p);
    else if (item.isFile() && item.name.endsWith('.nft.json')) paths.push(p);
  }
}
scan(resolve(root, 'server'));
if (paths.length === 0) {
  console.log('Next server trace audit: no .nft.json files generated; no bundle-size assertion.');
  process.exit(0);
}
let totalReferences = 0;
let totalReferencedBytes = 0;
const entries = [];
for (const p of paths) {
  let j;
  try { j = JSON.parse(readFileSync(p, 'utf8')); } catch { continue; }
  let bytes = 0;
  let count = 0;
  for (const f of j.files || []) {
    if (typeof f !== 'string') continue;
    const resolved = resolve(dirname(p), f);
    try {
      const s = statSync(resolved);
      if (!s.isFile()) continue;
      bytes += s.size;
      count++;
    } catch { /* not on this runner; do not change build outcome */ }
  }
  entries.push({ route: relative(root, p).split(sep).join('/'), bytes, count });
  totalReferences += count;
  totalReferencedBytes += bytes;
}
entries.sort((a, b) => b.bytes - a.bytes);
const mb = n => (n / 1024 / 1024).toFixed(2);
console.log('Next server trace audit: ' + entries.length + ' trace manifests, ' + totalReferences + ' file references');
console.log('Sum of traced references (duplicates included): ' + mb(totalReferencedBytes) + ' MiB');
console.log('Largest traced routes (top 12):');
for (const e of entries.slice(0, 12)) console.log('  ' + mb(e.bytes) + ' MiB | ' + e.count + ' files | ' + e.route);
console.log('This is NOT the actual compressed/deployed Vercel Function Storage measurement.');
