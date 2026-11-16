import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isAiPaidTier, aiDailyQuota, aiTenantDailyQuota, canUseAiAsTenantOfficer, canUseAiRollout } from '../lib/ai/policy.ts';
import { hasSensitiveAiIdentifiers } from '../lib/ai/privacy.ts';

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

test('production officer rollout is scoped by department and email and fails closed', () => {
  assert.equal(canUseAiRollout('jiecep','treasurer@example.edu',undefined,'officers'), false);
  assert.equal(canUseAiRollout('jiecep','treasurer@example.edu','jiecep:treasurer@example.edu',undefined), false);
  assert.equal(canUseAiRollout('jiecep','treasurer@example.edu','other:treasurer@example.edu','officers'), false);
  assert.equal(canUseAiRollout('jiecep','treasurer@example.edu','jiecep:*','officers'), false);
  assert.equal(canUseAiRollout('jiecep','treasurer@example.edu','JIECEP:TREASURER@example.edu','officers'), true);
  assert.equal(canUseAiRollout('other','treasurer@example.edu','jiecep:treasurer@example.edu','officers'), false);
  assert.equal(canUseAiRollout('other','treasurer@example.edu',undefined,'all-paid'), true);
  assert.equal(canUseAiRollout('jiecep','treasurer@example.edu','*','officers'), false);
});
test('production-only officer rollout is checked by the server and page', () => {
  const server = readFileSync('lib/ai/officer-assistant.ts', 'utf8');
  const page = readFileSync('app/department/[department]/(protected)/ai-assistant/page.tsx', 'utf8');
  assert.match(server, /canUseAiRollout/);
  assert.match(page, /canUseAiRollout/);
  assert.match(server, /CLEAR_AI_ALLOWED_OFFICERS/);
  assert.match(server, /CLEAR_AI_ROLLOUT_MODE/);
});

test('daily tenant request caps are independent of officer caps', () => {
  assert.equal(aiTenantDailyQuota('Freemium'), 0);
  assert.equal(aiTenantDailyQuota('Pro'), 120);
  assert.equal(aiTenantDailyQuota('Corporate'), 500);
  assert.equal(aiTenantDailyQuota('Unknown'), 0);
});
test('privacy filter rejects obvious identifiers but allows aggregate questions', () => {
  assert.equal(hasSensitiveAiIdentifiers('What are our current-semester collections?'), false);
  assert.equal(hasSensitiveAiIdentifiers('Summarize 2026 Q4 paid collections.'), false);
  assert.equal(hasSensitiveAiIdentifiers('Find student user@example.edu'), true);
  assert.equal(hasSensitiveAiIdentifiers('Contact 09171234567'), true);
  assert.equal(hasSensitiveAiIdentifiers('student ID: 2026123456'), true);
  assert.equal(hasSensitiveAiIdentifiers('my password: abcd1234'), true);
  assert.equal(hasSensitiveAiIdentifiers('bank account 12345678901'), true);
});
test('server requires explicit acknowledgment before sending to Gemini', () => {
  const route = readFileSync('app/api/ai/[department]/route.ts', 'utf8');
  const chat = readFileSync('app/department/[department]/(protected)/ai-assistant/OfficerAiChat.tsx', 'utf8');
  assert.match(route, /acknowledgeDataTransfer/);
  assert.match(route, /hasSensitiveAiIdentifiers\(question\)/);
  assert.match(chat, /acknowledgeDataTransfer: acknowledged/);
});
