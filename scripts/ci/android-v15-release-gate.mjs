#!/usr/bin/env node
/** Two-stage v1.5 gate: implementation completeness before APK; device UAT before publishing. */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const blockers = [];
const phase = process.argv.includes('--production') ? 'production' : 'pre-apk';
const config = read('mobile/src/api/config.ts');
const auth = read('app/api/mobile/orgs/[org]/auth/web-handoff/route.ts');
const global = read('app/api/mobile/global/auth/web-handoff/route.ts');
const capabilities = read('app/api/mobile/orgs/[org]/write-capabilities/route.ts');

if (/PAYMENT_WRITES_ENABLED\s*=\s*false/.test(config)) blockers.push('Native payment posting is disabled');
if (/MOBILE_BUSINESS_WRITES_ENABLED\s*=\s*false/.test(config)) blockers.push('Native business writes are disabled');
if (/enabled:\s*false\s*,\s*grants:\s*\[\s*\]/.test(capabilities)) blockers.push('Server-issued mobile write capabilities remain deny-all');
if (!/issueWebHandoff\(/.test(auth)) blockers.push('Officer seamless web sign-in is not wired');
if (!/issueWebHandoff\(/.test(global)) blockers.push('Global Administrator seamless web sign-in is not wired');
if (!existsSync(resolve(root, 'app/auth/mobile-handoff/page.tsx'))) blockers.push('Browser ticket exchange page is missing');
if (!existsSync(resolve(root, 'lib/mobile/web-handoff-redeem.ts'))) blockers.push('Web ticket redemption is missing');
if (!existsSync(resolve(root, 'mobile/src/lib/web-handoff.ts'))) blockers.push('Web handoff URL validator is missing');

// Physical-device UAT happens AFTER the first complete internal APK. Do not require
// production feature activation before that APK; production remains fail-closed.
if (phase === 'production' && process.env.MOBILE_WEB_HANDOFF_ENABLED !== 'true') {
  blockers.push('Secure mobile-to-web SSO has not been enabled and UAT-verified');
}
if (phase === 'production' && process.env.CLEAR_ANDROID_V15_UAT_APPROVED !== 'true') {
  blockers.push('Android v1.5.0 device UAT has not been approved');
}

if (blockers.length) {
  console.error(`Android v1.5.0 ${phase} NOT RELEASE-READY:`);
  blockers.forEach((reason, i) => console.error(`  ${i + 1}. ${reason}`));
  process.exitCode = 1;
} else {
  console.log(`Android v1.5.0 ${phase} static gate passed. Device UAT and production sign-off are separate.`);
}
