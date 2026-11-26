# CircleCI Free-plan efficiency policy — CLEAR SYS + CircuitByte

Both GitHub projects run in the existing **CLEAR Sys** CircleCI organization, using
separate repositories and `.circleci/config.yml` configurations. Vercel stays
responsible for deployments. CircleCI never connects to production Neon.

## CLEAR fail-open job-impact policy

All four existing CircleCI job names are retained so GitHub status checks stay
stable: `web`, `mobile`, `financial-security`, `student-auth-security`.

- **Production branch `main`: ALL jobs always run**, including full financial and
  student-auth integration tests before release. No security bypass for releases.
- **Feature branch changing only `mobile/**`**: run `mobile`; the three
  Next.js/database jobs exit successfully before dependency installation.
- **Feature branch changing only web UI paths** (`app/**` excluding API,
  `components/**`, `public/**`, `styles/**`): run web and both security
  jobs; `mobile` can exit early.
- **Documentation/issue-template-only feature branches**: all jobs exit early,
  preserving a visible passing status with an explicit SKIPPED explanation.
- **Shared backend/API, schema, auth, tests, dependencies, CI configuration,
  unknown files, or ambiguous/unavailable git history**: run every job.

`scripts/ci/check-impact.sh` uses a merge base with `main` on feature branches
so a later docs-only commit cannot hide earlier changed code. It fails open.
`scripts/ci/test-impact.sh` verifies the decision table during the web job.

Because jobs still start briefly to report stable CircleCI statuses, savings are
mostly from skipping `npm ci`, repeated Next.js builds, and Postgres integration
tests—not from eliminating all job-start credits. This also keeps existing required
check names from remaining pending after an otherwise safe skip.

The `web` job owns the npm download cache upload; `financial-security` restores
it but no longer uploads the same key a second time. Job caches are advisory and
do not replace `npm ci` or the committed lockfile.

## One-time owner controls (CircleCI UI only)

1. Under each CircleCI project, enable **auto-cancel redundant workflows**
   for non-default branches in **Project Settings → Advanced**.
2. Under the shared organization, review **Plan → Usage** and **Insights** weekly.
   Investigate expensive jobs before increasing resource classes or purchasing
   credits. Maintain a discretionary 10% credit reserve.
3. Keep both projects in the existing organization while the `engrken` GitHub App
   is associated with it. Do not disconnect the App or production secrets.

## Validation

- Run `bash scripts/ci/test-impact.sh` after changing the impact policy.
- Check every `main` job passes before production release.
- A skipped job is **not** evidence that its integration tests executed. Read
  job logs to distinguish true tested passes from change-based skips.
- Do not rely on simulated CI to certify financial integrity or physical devices.
