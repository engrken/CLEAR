/**
 * CLEAR default-branch ruleset transformation.
 * No network calls or repository writes in this file.
 */
export const CLEAR_REPO = 'engrken/CLEAR';
export const CLEAR_RULESET_ID = 25928765;
export const GITHUB_ACTIONS_APP_ID = 15368;
export const REQUIRED_CHECKS = Object.freeze([
  'clear-web',
  'clear-mobile',
  'authenticated-actions',
  'audit',
  'migrate',
  'sequence',
]);
export const MAIN_PUSH_CHECKS = Object.freeze([
  'clear-web',
  'clear-mobile',
  'authenticated-actions',
  'audit',
]);

function assertExistingPolicy(current) {
  if (!current || current.id !== CLEAR_RULESET_ID ||
      current.source !== CLEAR_REPO || current.target !== 'branch' ||
      current.enforcement !== 'active') {
    throw new Error('Repository or active branch ruleset identity changed. Refusing to update.');
  }
  if (!current.conditions?.ref_name?.include?.includes('~DEFAULT_BRANCH')) {
    throw new Error('Ruleset no longer targets the default branch. Refusing to update.');
  }
  if (!Array.isArray(current.bypass_actors)) {
    throw new Error('Unable to read bypass actors. Use an account with repository administration access.');
  }
  if (!Array.isArray(current.rules)) throw new Error('Ruleset rules missing.');
  for (const type of ['deletion', 'non_fast_forward', 'pull_request', 'required_status_checks']) {
    if (current.rules.filter(rule => rule.type === type).length !== 1) {
      throw new Error('Expected one existing ' + type + ' rule; refusing to alter unexpected rules.');
    }
  }
}

export function rulesetPayload(current) {
  return {
    name: current.name,
    target: current.target,
    enforcement: current.enforcement,
    bypass_actors: structuredClone(current.bypass_actors),
    conditions: structuredClone(current.conditions),
    rules: structuredClone(current.rules),
  };
}

/**
 * This conservative first stage preserves bypass actors and the current review count.
 * The six required checks are pinned to the actual GitHub Actions app (ID 15368).
 * --strict and --require-review are separately opt-in to avoid unexpected blocking.
 */
export function buildMainRuleset(current, { strict = false, requireReview = false } = {}) {
  assertExistingPolicy(current);
  const proposed = rulesetPayload(current);
  proposed.name = 'CLEAR GitHub CI (main)';
  const status = proposed.rules.find(rule => rule.type === 'required_status_checks');
  status.parameters = {
    ...status.parameters,
    strict_required_status_checks_policy: Boolean(strict),
    do_not_enforce_on_create: false,
    required_status_checks: REQUIRED_CHECKS.map(context => ({
      context,
      integration_id: GITHUB_ACTIONS_APP_ID,
    })),
  };
  if (requireReview) {
    const pr = proposed.rules.find(rule => rule.type === 'pull_request');
    pr.parameters = {
      ...pr.parameters,
      required_approving_review_count: Math.max(
        1, Number(pr.parameters?.required_approving_review_count) || 0,
      ),
      dismiss_stale_reviews_on_push: true,
    };
  }
  return proposed;
}

export function verifyMainRuleset(result, { strict = false, requireReview = false } = {}) {
  const status = result?.rules?.find(rule => rule.type === 'required_status_checks');
  const pr = result?.rules?.find(rule => rule.type === 'pull_request');
  const actual = status?.parameters?.required_status_checks || [];
  return result?.name === 'CLEAR GitHub CI (main)' &&
    result?.enforcement === 'active' &&
    result?.conditions?.ref_name?.include?.includes('~DEFAULT_BRANCH') &&
    result?.rules?.some(rule => rule.type === 'deletion') &&
    result?.rules?.some(rule => rule.type === 'non_fast_forward') &&
    actual.length === REQUIRED_CHECKS.length &&
    REQUIRED_CHECKS.every(context => actual.some(check =>
      check.context === context && check.integration_id === GITHUB_ACTIONS_APP_ID
    )) &&
    Boolean(status.parameters.strict_required_status_checks_policy) === Boolean(strict) &&
    (!requireReview || (pr?.parameters?.required_approving_review_count || 0) >= 1);
}
