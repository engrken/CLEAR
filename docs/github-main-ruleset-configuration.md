# CLEAR main branch: GitHub Actions ruleset hardening

## What is being protected

Repository: engrken/CLEAR (public)
Target: default branch (main), existing ruleset ID 25928765
Original ruleset: CircleCI; required checks were EMPTY before this change.
Verified on recent CLEAR pull requests: clear-web, clear-mobile, authenticated-actions, audit, migrate, sequence. All come from GitHub Actions, app integration ID 15368.

The script keeps existing branch deletion protection, non-fast-forward protection,
existing pull-request settings and current bypass actors. It only renames the
ruleset and requires the six Github Actions checks. The previous CircleCI web
check is not included because its status has been failing.

Important: the connected GitHub App does not have Administration (write)
permission, so merely merging this file does NOT apply the GitHub settings.
The repository owner must run the apply command in an authenticated Codespace,
or configure the equivalent controls in the GitHub Ruleset web interface.

## Apply using the existing GitHub Codespace

1. Open a Codespace for engrken/CLEAR, on main.
2. Run the following commands from the repository root:

       git pull --ff-only origin main
       gh auth status
       node scripts/security/configure-main-ruleset.mjs
       node scripts/security/configure-main-ruleset.mjs --apply
       node scripts/security/configure-main-ruleset.mjs --verify

3. Verify GitHub Settings > Rules > Rulesets:
   https://github.com/engrken/CLEAR/rules/25928765

A dry run makes no changes. The apply command uses the existing gh CLI login,
without requesting, printing or storing a new token in GitHub. It preserves
bypass actors and writes a rollback JSON payload privately under
~/.clear-ruleset-backups/. An account without repository Administration (write)
will receive a permissions error. Do not paste access tokens in ChatGPT or commits.

## Conservative first-stage choices

- Required checks: all 6 above. Their provider is GitHub Actions, not CircleCI.
- Branch up-to-date requirement: false by default to conserve GitHub Actions
  minutes. Requiring the latest main base is stronger but can trigger more CI.
  Run with --strict to enable after evaluating monthly quotas.
- Required PR approvals: retain the current count of zero for a potential
  sole-maintainer repository. To require another authorized reviewer and dismiss
  stale approvals, use --require-review only if a second maintainer is available.
- Bypass actors: preserve their original list to avoid breaking essential
  integrations without an independent bypass audit. IMPORTANT: the existing
  repository role and integration bypasses reduce the effectiveness of protection.
  After enabling checks, review the GitHub ruleset bypass list and restrict
  unnecessary "Always allow" exemptions. In particular, avoid routine admin
  bypasses for production merges.
- Do not require student-auth-runtime as a universal check: the workflow has
  path filters and does not run on every pull request.
- Do not require Vercel Preview status, which was not requested as a release
  dependency. This ruleset does not modify financial records, secrets or databases.

## Troubleshooting

- "Resource not accessible by integration" or HTTP 403:
  The current gh credentials lack Administration (write). Sign in using the
  repository owner account in Codespaces; do not create credentials here.
- HTTP 422: review the existing ruleset bypass actors or check names in the
  UI, and use the locally saved JSON backup to recover original settings.
- Missing check: confirm the job still runs on every pull request, and that the
  actual check run provider is github-actions before requiring it.
- CLI blocked: use Settings > Rules > Rulesets > existing CircleCI ruleset >
  Require status checks to pass, and select the six exact check names above.
  Preserve deletion/force-push restrictions and save.

Track follow-ups in Issue #167. This procedure does not alter AI activation.
