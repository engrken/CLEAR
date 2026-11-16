import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isAiPaidTier, aiDailyQuota, canUseAiAsTenantOfficer } from '../lib/ai/policy.ts';

test('only paid tiers unlock the assistant', () => {
  assert.equal(isAiPaidTier('Freemium'), false);
  assert.equal(isAiPaidTier('Pro'), true);
  assert.equal(isAiPaidTier('Corporate'), true);
  assert.equal(isAiPaidTier(undefined), false);
  assert.equal(isAiPaidTier('premium'), false);
});
test('quota limits and global administrator exclusion', () => {
  assert.equal(aiDailyQuota('Freemium'), 0);
  assert.equal(aiDailyQuota('Pro'), 30);
  assert.equal(aiDailyQuota('Corporate'), 100);
  assert.equal(aiDailyQuota('Unknown'), 0);
  assert.equal(canUseAiAsTenantOfficer(true), false);
  assert.equal(canUseAiAsTenantOfficer(false), true);
});
test('request route is off by default and limits streamed JSON', () => {
  const s = readFileSync('app/api/ai/[department]/route.ts', 'utf8');
  assert.match(s, /CLEAR_AI_ENABLED !== 'true'/);
  assert.match(s, /bytes > 4096/);
  assert.match(s, /reserveAiRequest/);
  assert.doesNotMatch(s, /prisma\.systemLog\.create/);
});
test('tenant gate is database verified, without generated writes', () => {
  const s = readFileSync('lib/ai/officer-assistant.ts', 'utf8');
  assert.match(s, /requireTenantMember\(department\)/);
  assert.match(s, /canUseAiAsTenantOfficer/);
  assert.match(s, /organization\.tier/);
  assert.doesNotMatch(s, /\$executeRaw/);
});
test('quota checks and inserts are inside an advisory locked transaction', () => {
  const s = readFileSync('lib/ai/quota.ts', 'utf8');
  assert.match(s, /\$transaction/);
  assert.match(s, /pg_advisory_xact_lock/);
  assert.match(s, /tx\.systemLog\.count/);
  assert.match(s, /tx\.systemLog\.create/);
});
