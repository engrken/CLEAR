import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REQUIRED_CHECKS, MAIN_PUSH_CHECKS, GITHUB_ACTIONS_APP_ID,
  buildMainRuleset, verifyMainRuleset,
} from '../scripts/security/main-ruleset-policy.mjs';

const starting = () => ({
  id: 25928765,
  name: 'CircleCI',
  source: 'engrken/CLEAR',
  target: 'branch',
  enforcement: 'active',
  bypass_actors: [{ actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'always' }],
  conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
  rules: [
    { type: 'deletion' },
    { type: 'pull_request', parameters: {
      required_approving_review_count: 0,
      required_review_thread_resolution: false,
      allowed_merge_methods: ['merge', 'squash', 'rebase'],
    } },
    { type: 'required_status_checks', parameters: {
      strict_required_status_checks_policy: false,
      do_not_enforce_on_create: false,
      required_status_checks: [],
    } },
    { type: 'non_fast_forward' },
  ],
});

test('requires the six confirmed GitHub checks, all pinned to GitHub Actions', () => {
  const current = starting();
  const actual = buildMainRuleset(current);
  const checks = actual.rules.find(rule => rule.type === 'required_status_checks').parameters.required_status_checks;
  assert.deepEqual(checks.map(check => check.context), REQUIRED_CHECKS);
  assert.ok(checks.every(check => check.integration_id === GITHUB_ACTIONS_APP_ID));
  assert.equal(actual.name, 'CLEAR GitHub CI (main)');
  assert.equal(verifyMainRuleset(actual), true);
  assert.equal(current.name, 'CircleCI');
  assert.equal(current.rules[2].parameters.required_status_checks.length, 0);
  assert.ok(MAIN_PUSH_CHECKS.every(name => REQUIRED_CHECKS.includes(name)));
});
test('existing branch rules and bypass actors are preserved', () => {
  const current = starting();
  current.rules.push({ type: 'required_signatures' });
  const actual = buildMainRuleset(current);
  assert.deepEqual(actual.bypass_actors, current.bypass_actors);
  assert.equal(actual.rules.length, current.rules.length);
  assert.ok(actual.rules.some(rule => rule.type === 'deletion'));
  assert.ok(actual.rules.some(rule => rule.type === 'non_fast_forward'));
  assert.ok(actual.rules.some(rule => rule.type === 'required_signatures'));
  assert.equal(actual.rules.find(rule => rule.type === 'pull_request')
    .parameters.required_approving_review_count, 0);
});
test('strict and second-reviewer modes are explicit opt-ins', () => {
  const current = starting();
  const actual = buildMainRuleset(current, { strict: true, requireReview: true });
  assert.equal(actual.rules.find(rule => rule.type === 'required_status_checks')
    .parameters.strict_required_status_checks_policy, true);
  assert.equal(actual.rules.find(rule => rule.type === 'pull_request')
    .parameters.required_approving_review_count, 1);
  assert.equal(actual.rules.find(rule => rule.type === 'pull_request')
    .parameters.dismiss_stale_reviews_on_push, true);
  assert.equal(verifyMainRuleset(actual, { strict: true, requireReview: true }), true);
  assert.equal(verifyMainRuleset(actual), false);
});
test('unsafe or unexpected ruleset changes fail closed', () => {
  const wrong = starting();
  wrong.source = 'other/repository';
  assert.throws(() => buildMainRuleset(wrong), /identity changed/);
  const changed = starting();
  changed.conditions.ref_name.include = ['refs/heads/feature'];
  assert.throws(() => buildMainRuleset(changed), /default branch/);
  const missingBypass = starting();
  delete missingBypass.bypass_actors;
  assert.throws(() => buildMainRuleset(missingBypass), /bypass actors/);
  const changedRule = starting();
  changedRule.rules = changedRule.rules.filter(rule => rule.type !== 'deletion');
  assert.throws(() => buildMainRuleset(changedRule), /deletion/);
});
test('repeat run remains idempotent after the name has changed', () => {
  const initial = buildMainRuleset(starting());
  const second = buildMainRuleset({ ...initial, id: 25928765, source: 'engrken/CLEAR' });
  assert.deepEqual(second, initial);
});
