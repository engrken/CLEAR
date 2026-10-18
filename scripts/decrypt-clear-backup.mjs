// Usage: BACKUP_ENCRYPTION_KEY=... node scripts/decrypt-clear-backup.mjs encrypted.json restored.json
// The output is sensitive: store it securely, and delete plaintext after recovery.
import fs from 'node:fs';
import crypto from 'node:crypto';

const [input, output] = process.argv.slice(2);
if (!input || !output || input === output) throw new Error('Supply different input and output JSON paths.');
const envelope = JSON.parse(fs.readFileSync(input, 'utf8'));
if (envelope.format !== 'CLEAR_ENCRYPTED_BACKUP_V1' || envelope.algorithm !== 'aes-256-gcm') {
  throw new Error('Unsupported encrypted backup.');
}
const raw = process.env.BACKUP_ENCRYPTION_KEY || '';
const key = /^[a-f\d]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
if (key.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY must be 32 bytes.');
const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
decipher.setAAD(Buffer.from(envelope.organizationId, 'utf8'));
decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
const decrypted = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]);
const snapshot = JSON.parse(decrypted.toString('utf8'));
if (snapshot.organization?.id !== envelope.organizationId) throw new Error('Organization mismatch in backup envelope.');
fs.writeFileSync(output, JSON.stringify(snapshot, null, 2), { mode: 0o600, flag: 'wx' });
console.log(`Decrypted organizational backup saved to ${output}. Protect and remove the plaintext when no longer needed.`);
