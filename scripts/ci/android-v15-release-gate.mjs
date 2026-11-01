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
if (/throw new ApiFailure\(503, 'unavailable'/.test(auth)) blockers.push('Officer seamless web sign-in is disabled');
if (/throw new ApiFailure\(503, 'unavailable'/.test(global)) blockers.push('Global Administrator seamless web sign-in is disabled');
if (!existsSync(resolve(root, 'mobile/src/lib/web-handoff.ts'))) blockers.push('Web handoff URL validator is missing');

if (blockers.length) {
  console.error('Android v1.5.0 NOT RELEASE-READY:');
  blockers.forEach((reason, i) => console.error(`  ${i + 1}. ${reason}`));
  process.exitCode = 1;
} else {
  console.log('No static release blockers detected. This is NOT a substitute for UAT and security sign-off.');
}
