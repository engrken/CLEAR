import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const src=readFileSync(new URL('../scripts/finance-cutover-fingerprint.mjs',import.meta.url),'utf8');
test('cutover fingerprint covers row-level centavos and audit links, read-only',()=>{
 assert.match(src,/SET TRANSACTION READ ONLY/);
 assert.match(src,/RepeatableRead/);
 assert.match(src,/createHmac\('sha256',key\)/);
 assert.match(src,/JSON\.stringify\(\[row\.rowId,cents,links\]\)/);
 assert.match(src,/BigInt\(sum\[col\]\)/);
 assert.match(src,/row\[col\]==null\?null:/);
 assert.match(src,/financial record fingerprint mismatch/);
});
test('cutover fingerprint refuses absent key, URL and scope',()=>{
 const r=spawnSync(process.execPath,['scripts/finance-cutover-fingerprint.mjs'],{
  cwd:new URL('../',import.meta.url),encoding:'utf8',
  env:{...process.env,CLEAR_DB_AUDIT_SCOPE:'prod-readonly',
   CLEAR_CUTOVER_AUDIT_KEY:'',DATABASE_URL:''},
 });
 assert.notEqual(r.status,0);
 assert.match(r.stderr,/STOP: financial fingerprint verification failed/);
 assert.doesNotMatch(r.stderr,/postgresql:\/\/|studentName|orNumber/);
});
