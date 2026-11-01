#!/usr/bin/env node
/** Fail-closed release gate for Android 1.5.0. Never publish while audited operations are disabled. */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const blockers = [];
const config = read('mobile/src/api/config.ts');
const auth = read('app/api/mobile/orgs/[org]/auth/web-handoff/route.ts');
const global = read('app/api/mobile/global/auth/web-handoff/route.ts');

if (/PAYMENT_WRITES_ENABLED\s*=\s*false/.test(config)) blockers.push('Native payment posting is disabled');
if (/MOBILE_BUSINESS_WRITES_ENABLED\s*=\s*false/.test(config)) blockers.push('Native business writes are disabled');
if (!/issueWebHandoff\(/.test(auth)) blockers.push('Officer seamless web sign-in is not wired');
if (!/issueWebHandoff\(/.test(global)) blockers.push('Global Administrator seamless web sign-in is not wired');
if (!existsSync(resolve(root, 'app/auth/mobile-handoff/page.tsx'))) blockers.push('Browser ticket exchange page is missing');
if (!existsSync(resolve(root, 'lib/mobile/web-handoff-redeem.ts'))) blockers.push('Web ticket redemption is missing');
if (!existsSync(resolve(root, 'mobile/src/lib/web-handoff.ts'))) blockers.push('Web handoff URL validator is missing');

// Server-side rollout is intentionally disabled unless an authorized production operator opts in.
if (process.env.MOBILE_WEB_HANDOFF_ENABLED !== 'true') blockers.push('Secure mobile-to-web SSO has not been enabled and UAT-verified');

if (blockers.length) {
  console.error('Android v1.5.0 NOT RELEASE-READY:');
  blockers.forEach((reason, i) => console.error(`  ${i + 1}. ${reason}`));
  process.exitCode = 1;
} else {
  console.log('No static release blockers detected. This is NOT a substitute for UAT and security sign-off.');
}
