import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('production handoff migration matches the exact reviewed Prisma checksum', () => {
  const sql = source('prisma/migrations/20261101150000_mobile_web_handoff/migration.sql');
  const checksum = createHash('sha256').update(sql).digest('hex');
  assert.equal(checksum, '8364c3f8908fd879d8c54cb29a9c1f56faa6b24aeadf56efe71ba6273c439913');
  const guard = source('scripts/ci/verify-handoff-production-migration.mjs');
  assert.match(guard, /actualChecksum !== checksum/);
  assert.match(guard, /ep-dry-wildflower-b35od340/);
  assert.match(guard, /\.neon\.tech/);
  assert.match(guard, /url\.pathname !== '\/neondb'/);
  assert.match(guard, /sslmode/);
  assert.match(guard, /row\.finished_at === null/);
  assert.match(guard, /byName\.get\(target\)/);
  assert.match(guard, /MobileWebHandoff_ticketHash_key/);
  assert.match(guard, /\$disconnect\(\)/);
  assert.doesNotMatch(guard, /\$executeRaw|INSERT INTO|DELETE FROM|DROP TABLE/);
});

test('production migration workflow is manual and isolated from APK packaging', () => {
  const workflow = source('.github/workflows/clear-v15-handoff-production-migration.yml');
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s+(?:push|pull_request|schedule):/m);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /APPLY_CLEAR_HANDOFF_MIGRATION/);
  assert.match(workflow, /production-db-migrations/);
  assert.match(workflow, /secrets\.CLEAR_PRODUCTION_DATABASE_URL/);
  assert.match(workflow, /approved_main_sha/);
  assert.match(workflow, /preflight|Preflight/);
  assert.match(workflow, /node scripts\/ci\/verify-handoff-production-migration\.mjs pre/);
  assert.match(workflow, /npx prisma migrate deploy/);
  assert.match(workflow, /node scripts\/ci\/verify-handoff-production-migration\.mjs post/);
  assert.doesNotMatch(workflow, /eas build|eas submit|db push|migrate reset|migrate dev/);
});
