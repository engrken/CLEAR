#!/usr/bin/env node
/**
 * v1.5.0 source gate for the approved web-first, READ-ONLY FINANCE release.
 * Pre-APK success authorizes packaging for internal UAT only, not production.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const read = p => readFileSync(resolve(root, p), 'utf8');
const blockers = [];
const phase = process.argv.includes('--production') ? 'production' : 'pre-apk';
const config = read('mobile/src/api/config.ts');
const portal = read('mobile/src/app/(officer)/more.tsx');
const student = read('mobile/src/app/(officer)/students.tsx');
const profile = read('mobile/src/app/officer/profile.tsx');
const security = read('mobile/src/lib/biometrics.ts');
const gate = read('lib/mobile/production-readonly.ts');
const bundle = JSON.parse(read('mobile/app.json'));
const eas = JSON.parse(read('mobile/eas.json'));

// Read-only financial policy is an explicit release REQUIREMENT, not a blocker.
// Never let a future environmental flag silently convert the APK to a cashier.
for (const flag of ['PAYMENT_WRITES_ENABLED', 'REMITTANCE_WRITES_ENABLED', 'MOBILE_BUSINESS_WRITES_ENABLED']) {
  if (!new RegExp('export const ' + flag + '\\s*=\\s*false\\s*;').test(config)) {
    blockers.push(flag + ' must remain hard-disabled for web-first v1.5.0');
  }
}
if (!/TENANT_OPERATIONS_ENABLED/.test(config) || !/EXPO_PUBLIC_CLEAR_TENANT_OPERATIONS/.test(config)) {
  blockers.push('Tenant operations must remain separately gated');
}
if (!/canRunMobileRosterWrites/.test(gate) ||
    !/canOfferMobileWrite\\(capability.data, 'students.create'/.test(student) ||
    !/canOfferMobileWrite\\(capability.data, 'students.update'/.test(student) ||
    !/STUDENT_ROSTER_WRITES_ENABLED/.test(config)) {
  blockers.push('Native student roster create/update must be independently server-granted');
}
if (!/requestOfficerEmailChangeCurrentCode/.test(profile) ||
    !/verifyOfficerEmailChangeCurrentCode/.test(profile) ||
    !/confirmOfficerEmailChange/.test(profile)) {
  blockers.push('Native profile email editing must require dual-address OTP');
}
if (!/SecureStore.setItemAsync\\(PROOF/.test(security) ||
    !/requireAuthentication: true/.test(security) ||
    !/unlockWithBiometrics/.test(read('mobile/src/app/_layout.tsx'))) {
  blockers.push('OS-protected biometric app-lock and server OTP fallback missing');
}
if (!/openDepartmentModule\\(session.org.subdomain, m.webPath!\\)/.test(portal) ||
    !/switchToDepartmentWebPortal/.test(portal) ||
    !/WEB_MODULE_PATHS.has\\(route\\)/.test(read('mobile/src/lib/links.ts'))) {
  blockers.push('First-party role-protected financial web handoff missing');
}
if (!/name="finance-review"/.test(read('mobile/src/app/(officer)/_layout.tsx')) ||
    !/name="void-audit"/.test(read('mobile/src/app/(officer)/_layout.tsx'))) {
  blockers.push('Read-only financial review and Void audit screens missing');
}
if (!existsSync(resolve(root, 'app/api/mobile/orgs/[org]/students/manage/route.ts')) ||
    !existsSync(resolve(root, 'app/api/mobile/orgs/[org]/write-capabilities/route.ts'))) {
  blockers.push('Roster server authorization routes missing');
}
if (bundle.expo?.version !== '1.5.0' ||
    bundle.expo?.android?.package !== 'com.rupertbulquerin.clear' ||
    !Number.isSafeInteger(bundle.expo?.android?.versionCode) ||
    bundle.expo.android.versionCode <= 15) {
  blockers.push('Android package identity/versionCode has not been staged for v1.5.0');
}
const profileUat = eas.build?.['v15-uat-readonly'];
if (profileUat?.distribution !== 'internal' || profileUat.android?.buildType !== 'apk' ||
    profileUat.env?.EXPO_PUBLIC_API_URL !== 'https://clearsys.vercel.app/api/mobile' ||
    profileUat.env?.EXPO_PUBLIC_CLEAR_TENANT_OPERATIONS !== 'false' ||
    profileUat.env?.EXPO_PUBLIC_CLEAR_STUDENT_ROSTER_WRITES !== 'false') {
  blockers.push('Safe read-only internal APK build profile must be pinned to Production HTTPS and no business or roster writes');
}
if (phase === 'production') {
  if (process.env.CLEAR_ANDROID_V15_UAT_APPROVED !== 'true') blockers.push('Signed Android v1.5.0 device UAT has not been approved');
  if (process.env.CLEAR_ANDROID_V15_PLAY_VERSIONCODE_CONFIRMED !== 'true') blockers.push('Google Play versionCode and upload signing are not verified');
  if (process.env.CLEAR_ANDROID_V15_ROSTER_UAT_APPROVED !== 'true') blockers.push('Native roster write UAT against authorized isolated data is not approved');
}
if (blockers.length) {
  console.error(`Android v1.5.0 ${phase} NOT RELEASE-READY:`);
  blockers.forEach((reason, index) => console.error(`  ${index + 1}. ${reason}`));
  process.exitCode = 1;
} else {
  console.log(`Android v1.5.0 ${phase} static safety gate PASSED. A signed APK, device UAT and separately authorized roster writes are still required.`);
}
