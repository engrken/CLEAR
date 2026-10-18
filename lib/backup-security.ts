// Shared wire format with existing CLEAR automated Vercel Blob backups.
// Keep this server-only. NEVER import into a client component.
import 'server-only';
import crypto from 'node:crypto';

export const BACKUP_FORMAT = 'CLEAR_ENCRYPTED_BACKUP_V1';

type EncryptedEnvelope = {
  format: typeof BACKUP_FORMAT;
  organizationId: string;
  algorithm: 'aes-256-gcm';
  iv: string;
  authTag: string;
  ciphertext: string;
};

export class InvalidBackupError extends Error {
  constructor(message = 'Encrypted backup integrity verification failed. File may be modified, corrupt, or made with another key.') {
    super(message);
    this.name = 'InvalidBackupError';
  }
}

export class MissingBackupKeyError extends Error {
  constructor() {
    super('Backup encryption is not configured on the server.');
    this.name = 'MissingBackupKeyError';
  }
}

function getKey(): Buffer {
  const raw = process.env.BACKUP_ENCRYPTION_KEY?.trim() || '';
  // Support the established CLEAR cron configuration: 64 hex chars or 32 bytes as base64.
  let key: Buffer;
  if (/^[a-f0-9]{64}$/i.test(raw)) key = Buffer.from(raw, 'hex');
  else if (/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(raw)) key = Buffer.from(raw, 'base64');
  else throw new MissingBackupKeyError();
  if (key.length !== 32) throw new MissingBackupKeyError();
  return key;
}

function base64Field(value: unknown, byteLength?: number): Buffer {
  if (typeof value !== 'string' || !value || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new InvalidBackupError();
  }
  const result = Buffer.from(value, 'base64');
  if (byteLength !== undefined && result.length !== byteLength) throw new InvalidBackupError();
  if (result.toString('base64') !== value) throw new InvalidBackupError();
  return result;
}

export function encryptClearBackup(snapshot: unknown, organizationId: string): EncryptedEnvelope {
  if (!organizationId) throw new InvalidBackupError();
  const iv = crypto.randomBytes(12); // Never reuse an IV with the same key.
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  cipher.setAAD(Buffer.from(organizationId, 'utf8'));
  const plaintext = Buffer.from(JSON.stringify(snapshot), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    format: BACKUP_FORMAT,
    organizationId,
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

export function decryptClearBackup(rawFile: string, expectedOrganizationId: string): Record<string, any> {
  let parsed: unknown;
  try { parsed = JSON.parse(rawFile); }
  catch { throw new InvalidBackupError('Invalid encrypted backup file.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new InvalidBackupError();
  const item = parsed as Partial<EncryptedEnvelope>;
  // Plain JSON backups are deliberately NOT accepted: they have no tamper protection.
  if (item.format !== BACKUP_FORMAT || item.algorithm !== 'aes-256-gcm' ||
      typeof item.organizationId !== 'string' || item.organizationId !== expectedOrganizationId) {
    throw new InvalidBackupError('Unsupported or wrong-organization backup. Only signed-and-encrypted CLEAR snapshots are accepted.');
  }
  const iv = base64Field(item.iv, 12);
  const tag = base64Field(item.authTag, 16);
  const ciphertext = base64Field(item.ciphertext);
  if (!ciphertext.length) throw new InvalidBackupError();
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAAD(Buffer.from(expectedOrganizationId, 'utf8'));
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const backup = JSON.parse(plain.toString('utf8')) as Record<string, any>;
    if (!backup || typeof backup !== 'object' || backup.organization?.id !== expectedOrganizationId ||
        !backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data)) {
      throw new InvalidBackupError();
    }
    return backup;
  } catch (error) {
    if (error instanceof MissingBackupKeyError) throw error;
    throw new InvalidBackupError();
  }
}
