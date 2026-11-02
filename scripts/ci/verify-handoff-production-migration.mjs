#!/usr/bin/env node
/**
 * Read-only pre/post verification for a SINGLE reviewed production migration.
 * Deliberately never changes a database or prints a connection string.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const target = '20261101150000_mobile_web_handoff';
const checksum = '8364c3f8908fd879d8c54cb29a9c1f56faa6b24aeadf56efe71ba6273c439913';
const expectedEndpoint = 'ep-dry-wildflower-b35od340';
const phase = process.argv[2];
if (!['pre', 'post'].includes(phase)) throw Error('Expected pre or post validation mode.');
const urlString = process.env.DATABASE_URL;
if (!urlString) throw Error('Scoped production database secret is missing.');
let url;
try { url = new URL(urlString); } catch { throw Error('Database secret is not a valid URL.'); }
if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname.endsWith('.neon.tech') ||
    url.hostname.split('.')[0].replace(/-pooler$/, '') !== expectedEndpoint ||
    url.pathname !== '/neondb' ||
    url.searchParams.get('sslmode') !== 'require') {
  throw Error('Database URL does not match the explicitly approved Neon Production endpoint.');
}
const root = resolve(import.meta.dirname, '../..');
const filePath = resolve(root, 'prisma/migrations', target, 'migration.sql');
const actualChecksum = createHash('sha256').update(readFileSync(filePath)).digest('hex');
if (actualChecksum !== checksum) throw Error('Reviewed Prisma migration SQL checksum changed; refuse execution.');

const names = readdirSync(resolve(root, 'prisma/migrations'), { withFileTypes: true })
  .filter(x => x.isDirectory()).map(x => x.name);
const prisma = new PrismaClient();
try {
  const ledger = await prisma.$queryRaw`SELECT migration_name, checksum, finished_at, rolled_back_at
    FROM "_prisma_migrations"`;
  const byName = new Map(ledger.map(row => [row.migration_name, row]));
  for (const name of names) {
    const row = byName.get(name);
    if (name !== target && (!row || row.finished_at === null || row.rolled_back_at !== null))
      throw Error('Another required Prisma migration is not finished; refuse single-migration deployment.');
  }
  for (const row of ledger) {
    if (row.finished_at === null && row.rolled_back_at === null)
      throw Error('Unresolved failed migration; refuse deployment.');
  }
  const record = byName.get(target);
  const found = await prisma.$queryRaw`SELECT to_regclass('public."MobileWebHandoff"') IS NOT NULL AS present`;
  const tableReady = found[0]?.present === true;
  if (phase === 'pre') {
    if (record || tableReady) {
      if (!record || record.finished_at === null || record.rolled_back_at !== null ||
          record.checksum !== checksum || !tableReady)
        throw Error('Partial or mismatched handoff migration; stop rather than repairing automatically.');
      console.log('PRECHECK PASSED: target migration is already applied; no changes are needed.');
    } else {
      console.log('PRECHECK PASSED: only the approved handoff migration is pending.');
    }
  } else {
    if (!record || record.finished_at === null || record.rolled_back_at !== null ||
        record.checksum !== checksum || !tableReady)
      throw Error('Post-deployment migration/table validation failed.');
    const indexes = await prisma.$queryRaw`SELECT indexname FROM pg_indexes
      WHERE schemaname='public' AND tablename='MobileWebHandoff'`;
    const present = new Set(indexes.map(x => x.indexname));
    for (const index of ['MobileWebHandoff_pkey', 'MobileWebHandoff_ticketHash_key',
      'MobileWebHandoff_principalType_principalId_createdAt_idx',
      'MobileWebHandoff_mobileSessionId_consumedAt_idx',
      'MobileWebHandoff_expiresAt_idx']) {
      if (!present.has(index)) throw Error('Required handoff index is missing.');
    }
    console.log('POSTCHECK PASSED: reviewed Prisma migration, table and indexes are present.');
  }
} finally {
  await prisma.$disconnect();
}
