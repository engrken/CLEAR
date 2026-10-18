/* Offline test. No database/SMTP/network access. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const file = path.join(process.cwd(), 'lib/transaction-email-preferences.ts');
const source = fs.readFileSync(file, 'utf8');
const compiled = ts.transpileModule(source, { fileName: file, compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
}, reportDiagnostics: true });
const m = new Module(file);
m.filename = file;
m.paths = Module._nodeModulePaths(path.dirname(file));
m.require = (id) => id === 'server-only' ? {} : require(id);
m._compile(compiled.outputText, file);
const api = m.exports;
const prevSecret = process.env.EMAIL_PREFERENCES_SECRET;
const prevBase = process.env.EMAIL_PREFERENCES_BASE_URL;
try {
  process.env.EMAIL_PREFERENCES_SECRET = 'p'.repeat(48);
  process.env.EMAIL_PREFERENCES_BASE_URL = 'https://clear.example.edu';
  assert.equal(api.normalizePreferenceEmail(' USER@EXAMPLE.EDU '),'user@example.edu');
  assert.throws(() => api.normalizePreferenceEmail('not an email'));
  const token = api.signEmailPreferenceLink('test-organization','student@example.edu');
  assert.ok(token && token.length > 32);
  assert.ok(!token.includes('student@example.edu'));
  assert.deepEqual(api.verifyEmailPreferenceLink(token)?.email, 'student@example.edu');
  const raw = Buffer.from(token, 'base64url');raw[raw.length-1] ^= 0x80;
  assert.equal(api.verifyEmailPreferenceLink(raw.toString('base64url')), null);
  assert.equal(api.verifyEmailPreferenceLink('invalid'), null);
  assert.ok(api.emailPreferenceUrl('test-organization','student@example.edu').startsWith('https://clear.example.edu/email/preferences?token='));
  assert.equal(api.mayDeliverToRole('Student',{receiveParticipantEmails:false,receiveOfficerCopies:true}),false);
  assert.equal(api.mayDeliverToRole('Processing Officer (Duplicate Copy)',{receiveParticipantEmails:false,receiveOfficerCopies:true}),true);
  assert.equal(api.mayDeliverToRole('Processing Officer (Duplicate Copy)',{receiveParticipantEmails:true,receiveOfficerCopies:false}),false);
  assert.equal(api.mayDeliverToRole('Student + Processing Officer (Duplicate Copy)',{receiveParticipantEmails:false,receiveOfficerCopies:true}),false);
  assert.equal(api.mayDeliverToRole('Student',{receiveParticipantEmails:true,receiveOfficerCopies:true}),true);
  const original = Date.now;
  try { Date.now = () => original() + 91*86400000;assert.equal(api.verifyEmailPreferenceLink(token),null); }
  finally { Date.now = original; }
  process.env.EMAIL_PREFERENCES_SECRET='another-secret-string-long-enough-for-testing';
  assert.equal(api.verifyEmailPreferenceLink(token),null);
  process.env.EMAIL_PREFERENCES_SECRET='p'.repeat(48);
  process.env.EMAIL_PREFERENCES_BASE_URL='http://unsafe.example.edu';
  assert.equal(api.emailPreferenceUrl('test-organization','student@example.edu'),null);
  console.log('PASS: recipient opt-outs, separate officer copies, combined roles, encrypted links, tampering, expiry, wrong key, unsafe URL.');
} finally {
  if (prevSecret === undefined) delete process.env.EMAIL_PREFERENCES_SECRET;
  else process.env.EMAIL_PREFERENCES_SECRET=prevSecret;
  if (prevBase === undefined) delete process.env.EMAIL_PREFERENCES_BASE_URL;
  else process.env.EMAIL_PREFERENCES_BASE_URL=prevBase;
}
