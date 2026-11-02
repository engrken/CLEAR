# CLEAR development instructions

CLEAR is a multi-tenant financial clearance system with Next.js, Prisma/PostgreSQL and a separate Expo mobile application.

Read AGENTS.md and applicable Next.js bundled documentation. Preserve tenant isolation, server-side role authorization, receipt sequencing, payment idempotency and financial audit history. Use Asia/Manila for business dates. Never repair historical financial records by guessing. Keep mobile/web contracts aligned. Never run migrations, seed commands or financial tests against production. Preserve release gates and reviewed Android release commits.

## Working practice

- Read existing code and applicable AGENTS.md files before editing. Keep changes focused and preserve unrelated work.
- Use the repository's existing dependencies and package manager. Do not invent test commands.
- Never print or commit credentials, environment files, personal student/customer data or production database exports.
- Prefer focused local checks. Batch changes to conserve CI and deployment quotas. Do not start cloud builds, deployments or migrations solely to validate documentation or development configuration.
- State what was actually verified and what remains untested. Successful compilation is not proof of live service or hardware correctness.
- GitHub Education entitlements belong to the eligible account/organization; repository configuration does not redeem benefits or supply public SaaS inference credits.

## Setup and validation

Available checks: npm run test:time, npm run test:finance and npm run lint. Read .circleci/config.yml for isolated integration checks. The root install generates Prisma Client but does not migrate a database. Mobile dependencies are installed separately in mobile/.

See GITHUB_EDUCATION.md for cloud development and activation steps.
