#!/usr/bin/env node
/**
 * Set the existing CLEAR GitHub ruleset using the repository owner's gh login.
 * Dry run by default. No token, secrets or credentials are stored in the repo.
 *
 *  node scripts/security/configure-main-ruleset.mjs
 *  node scripts/security/configure-main-ruleset.mjs --apply
 *  node scripts/security/configure-main-ruleset.mjs --verify
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CLEAR_REPO, CLEAR_RULESET_ID, GITHUB_ACTIONS_APP_ID,
  MAIN_PUSH_CHECKS, REQUIRED_CHECKS, buildMainRuleset,
  rulesetPayload, verifyMainRuleset,
} from './main-ruleset-policy.mjs';

const argumentsList = process.argv.slice(2);
const valid = ['--apply', '--verify', '--strict', '--require-review', '--help'];
if (argumentsList.some(arg => !valid.includes(arg)) ||
    argumentsList.includes('--verify') && argumentsList.includes('--apply')) {
  console.error('Unsupported arguments. Run with --help.');
  process.exit(2);
}

if (argumentsList.includes('--help')) {
  console.log('Usage: node scripts/security/configure-main-ruleset.mjs [--apply | --verify] [--strict] [--require-review]');
  console.log('Default: dry run. --apply changes GitHub settings using YOUR gh CLI session.');
  console.log('--strict requires branch to be current, increasing CI runs.');
  console.log('--require-review requires a second reviewer; avoid on a one-maintainer repo.');
  process.exit(0);
}

const options = {
  strict: argumentsList.includes('--strict'),
  requireReview: argumentsList.includes('--require-review'),
};
const rulePath = 'repos/' + CLEAR_REPO + '/rulesets/' + CLEAR_RULESET_ID;
function ghGet(path) {
  return JSON.parse(execFileSync('gh',
    ['api', path, '-H', 'Accept: application/vnd.github+json'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 4 * 1024 * 1024 },
  ));
}

try {
  const original = ghGet(rulePath);
  const proposed = buildMainRuleset(original, options);
  const status = original.rules.find(rule => rule.type === 'required_status_checks');
  const previous = (status.parameters?.required_status_checks || []).map(check => check.context);

  console.log('Repository: ' + CLEAR_REPO);
  console.log('Ruleset: ' + CLEAR_RULESET_ID + ' (main)');
  console.log('Existing required checks: ' + (previous.join(', ') || '(none)'));
  console.log('Target checks: ' + REQUIRED_CHECKS.join(', '));
  console.log('Pinned provider: GitHub Actions (app ID ' + GITHUB_ACTIONS_APP_ID + ')');
  console.log('Existing bypass actors retained: ' + original.bypass_actors.length);
  console.log('Strict latest-base check: ' + options.strict);
  console.log('Required reviewer: ' +
    (options.requireReview ? 'at least 1' : 'existing policy retained'));

  if (argumentsList.includes('--verify')) {
    if (!verifyMainRuleset(original, options)) {
      throw new Error('Ruleset does not match the requested GitHub CI settings.');
    }
    console.log('Verified: required GitHub CI settings are active.');
  } else if (!argumentsList.includes('--apply')) {
    console.log('DRY RUN ONLY: no GitHub settings changed.');
    console.log('Next: node scripts/security/configure-main-ruleset.mjs --apply');
  } else {
    // Required jobs on main should already be GitHub Actions check runs.
    // Prisma and receipt jobs run on PRs only and therefore are not in this main list.
    const head = ghGet('repos/' + CLEAR_REPO + '/commits/main/check-runs?per_page=100');
    const current = head.check_runs || [];
    for (const name of MAIN_PUSH_CHECKS) {
      if (!current.some(check => check.name === name &&
          check.app?.id === GITHUB_ACTIONS_APP_ID && check.conclusion === 'success')) {
        throw new Error('Main branch does not have successful GitHub Actions check: ' + name);
      }
    }
    const backupDir = join(homedir(), '.clear-ruleset-backups');
    mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = join(backupDir, 'main-ruleset-' + timestamp + '.json');
    writeFileSync(backupPath, JSON.stringify(rulesetPayload(original), null, 2) + '\n', { mode: 0o600 });
    console.log('Rollback configuration saved privately at: ' + backupPath);

    const folder = mkdtempSync(join(tmpdir(), 'clear-ruleset-'));
    try {
      const input = join(folder, 'ruleset.json');
      writeFileSync(input, JSON.stringify(proposed), { mode: 0o600 });
      execFileSync('gh', [
        'api', '-X', 'PUT', rulePath, '--input', input,
        '-H', 'Accept: application/vnd.github+json',
      ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 4 * 1024 * 1024 });
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
    const fresh = ghGet(rulePath);
    if (!verifyMainRuleset(fresh, options)) {
      throw new Error('GitHub accepted update but independent read-back verification failed. Inspect ruleset immediately.');
    }
    console.log('SUCCESS: GitHub required status checks are active on main.');
    console.log('Verify UI: https://github.com/' + CLEAR_REPO + '/rules/' + CLEAR_RULESET_ID);
  }
} catch (error) {
  console.error('Ruleset configuration stopped: ' + (error?.message || error));
  console.error('Nothing changes unless --apply successfully updates GitHub. Verify repository-admin gh auth.');
  process.exitCode = 1;
}
