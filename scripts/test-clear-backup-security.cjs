// Run from the CLEAR project root: node scripts/test-clear-backup-security.cjs
// No database, network access, or files are modified.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ts = require('typescript');
const sourcePath = path.resolve('lib/backup-security.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const inst = new Module(sourcePath, module);
inst.filename = sourcePath;
inst.paths = Module._nodeModulePaths(path.dirname(sourcePath));
const originalRequire = inst.require.bind(inst);
inst.require = n => n === 'server-only' ? {} : originalRequire(n);
inst._compile(js, sourcePath);
const {encryptClearBackup, decryptClearBackup, InvalidBackupError} = inst.exports;
const previousKey = process.env.BACKUP_ENCRYPTION_KEY;
process.env.BACKUP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
const org = 'test-organization-id';
const example = { version:'1.0', organization: {id:org}, data:{ collections:[{id:'r1',organizationId:org,amountPaid:12.5}] } };
try {
  const encrypted = encryptClearBackup(example,org);
  const asText = JSON.stringify(encrypted);
  assert(!asText.includes('amountPaid'));
  assert(!asText.includes('12.5'));
  assert.deepEqual(decryptClearBackup(asText,org),example);
  assert.throws(() => decryptClearBackup(JSON.stringify(example),org), InvalidBackupError);
  assert.throws(() => decryptClearBackup(asText,'different-org'),InvalidBackupError);
  for (const field of ['ciphertext','authTag','iv']) {
    const tampered = {...encrypted};
    const decoded=Buffer.from(tampered[field],'base64');decoded[0]^=0x01;
    tampered[field]=decoded.toString('base64');
    assert.throws(() => decryptClearBackup(JSON.stringify(tampered),org),InvalidBackupError,field);
  }
  process.env.BACKUP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  assert.throws(() => decryptClearBackup(asText,org),InvalidBackupError);
  console.log('PASS: round-trip, plaintext rejection, wrong organization, tampering, wrong key.');
} finally {
  if(previousKey===undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
  else process.env.BACKUP_ENCRYPTION_KEY=previousKey;
}
