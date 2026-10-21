// Source-only release workflow invariants. No API or production secrets required.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const workflow = readFileSync(new URL('../../.github/workflows/android-live-viewer-internal-apk.yml', import.meta.url), 'utf8');
assert.match(workflow, /workflow_dispatch:/, 'Manual build only');
assert.doesNotMatch(workflow, /^\s+(?:push|pull_request|schedule):/m, 'Never build on push/PR/timer');
assert.match(workflow, /github\.ref == 'refs\/heads\/main'/, 'Require reviewed main');
assert.match(workflow, /inputs\.production_database_mapping_verified/, 'Require Vercel/Neon mapping confirmation');
assert.match(workflow, /inputs\.qa_build_confirmation == 'BUILD_QA_APK_ONLY'/, 'Require literal QA-only approval');
assert.match(workflow, /deployed_production_sha/, 'Require exact deployed server SHA');
assert.match(workflow, /\$APPROVED_SHA" != "\$GITHUB_SHA"/, 'Require matching deployed/checked-out SHA');
assert.doesNotMatch(workflow, /security_and_device_qa_approved|physical_device_qa_approved|all_role_qa_passed/, 'Device QA follows the QA APK build');
assert.match(workflow, /--profile live-readonly-internal --non-interactive --no-wait/, 'Queue only internal QA APK');
assert.doesNotMatch(workflow, /\beas\s+submit\b|\bgh\s+release\s+create\b|\bvercel\s+(?:deploy|--prod)\b|\bprisma\s+(?:migrate|db)\b/, 'Build workflow must not deploy/distribute/migrate');
assert.match(workflow, /node scripts\/verify-live-viewer\.mjs/, 'Validate endpoint and disabled mobile writes');
assert.match(workflow, /npm run typecheck/, 'Check Android compilation');
console.log('PASS: QA-only EAS build is separate from later device sign-off and distribution.');
