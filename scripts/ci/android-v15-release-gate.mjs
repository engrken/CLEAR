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
if (!/if \(verb === 'POST' && FINANCIAL_POSTS\.test\(path\)\) return false/.test(gate) ||
    /env\.financialWritesEnabled === true/.test(gate) ||
    /MOBILE_FINANCIAL_WRITES_ENABLED === 'true'/.test(read('lib/mobile/http.ts'))) {
  blockers.push('Mobile cash POST must stay hard-disabled on the backend regardless of deployment flags');
}
if (!read('mobile/src/lib/write-permissions.ts').includes('cashSensitiveActions.has(action)')) {
  blockers.push('Android cash-affecting write grants must be denied regardless of capability replies');
}

if (!/TENANT_OPERATIONS_ENABLED/.test(config) || !/EXPO_PUBLIC_CLEAR_TENANT_OPERATIONS/.test(config)) {
  blockers.push('Tenant operations must remain separately gated');
}
if (!gate.includes('canRunMobileRosterWrites') ||
    !student.includes("canOfferMobileWrite(capability.data, 'students.create'") ||
    !student.includes("canOfferMobileWrite(capability.data, 'students.update'") ||
    !config.includes('STUDENT_ROSTER_WRITES_ENABLED')) {
  blockers.push('Native student roster create/update must be independently server-granted');
}

if (!/requestOfficerEmailChangeCurrentCode/.test(profile) ||
    !/verifyOfficerEmailChangeCurrentCode/.test(profile) ||
    !/confirmOfficerEmailChange/.test(profile)) {
  blockers.push('Native profile email editing must require dual-address OTP');
}
if (!security.includes('SecureStore.setItemAsync(PROOF') ||
    !security.includes('requireAuthentication: true') ||
    !read('mobile/src/app/_layout.tsx').includes('unlockWithBiometrics(identity)') ||
    !read('mobile/src/app/_layout.tsx').includes('biometricPromptActive.current')) {
  blockers.push('Real-device biometric app-lock, prompt background protection and OTP fallback missing');
}

if (!portal.includes('openDepartmentModule(session.org.subdomain, m.webPath!)') ||
    !portal.includes('switchToDepartmentWebPortal') ||
    !read('mobile/src/lib/links.ts').includes('WEB_MODULE_PATHS.has(route)')) {
  blockers.push('First-party role-protected financial web handoff missing');
}

if (!/name="finance-review"/.test(read('mobile/src/app/(officer)/_layout.tsx')) ||
    !/name="void-audit"/.test(read('mobile/src/app/(officer)/_layout.tsx'))) {
  blockers.push('Read-only financial review and Void audit screens missing');
}
if (!existsSync(resolve(root,'mobile/src/app/(officer)/clearance-admin.tsx')) ||
    !read('mobile/src/app/(officer)/_layout.tsx').includes("can('tab-clearance')")) {
  blockers.push('Authorized native officer clearance review is missing');
}
if (!existsSync(resolve(root, 'app/api/mobile/orgs/[org]/users/manage/route.ts')) ||
    !read('mobile/src/app/(officer)/users.tsx').includes('OfficerEditor') ||
    !read('app/api/mobile/orgs/[org]/write-capabilities/route.ts').includes("'tenant.roles.manage'") ||
    !read('lib/mobile/production-readonly.ts').includes('canRunMobileTenantUserManageWrites')) {
  blockers.push('Native officer creation and role/permission editing require independent server authorization');
}
if (!existsSync(resolve(root, 'app/api/mobile/orgs/[org]/academic-calendar/route.ts')) ||
    !existsSync(resolve(root, 'mobile/src/app/(officer)/academic-calendar.tsx')) ||
    !gate.includes('canRunMobileAcademicSettingsWrites')) {
  blockers.push('Academic Calendar native configuration needs an audited independent server grant');
}
if (!existsSync(resolve(root,'app/api/mobile/orgs/[org]/report-signatories/route.ts')) ||
    !existsSync(resolve(root,'mobile/src/app/(officer)/report-presentation.tsx')) ||
    !gate.includes('canRunMobileReportSignatoryWrites')) {
  blockers.push('Noncash native report signatories need an independent server capability');
}
if (!existsSync(resolve(root,'app/api/mobile/orgs/[org]/reports/route.ts')) ||
    !existsSync(resolve(root,'app/api/mobile/orgs/[org]/realign-review/route.ts')) ||
    !read('mobile/src/app/(officer)/_layout.tsx').includes("can('tab-transfer')")) {
  blockers.push('Financial reporting and fund movement require safe native role-scoped reviews');
}
if (!existsSync(resolve(root, 'app/api/mobile/orgs/[org]/collectibles/route.ts')) ||
    !existsSync(resolve(root, 'mobile/src/app/(officer)/collectibles.tsx')) ||
    !read('mobile/src/app/(officer)/_layout.tsx').includes("can('tab-collectibles')")) {
  blockers.push('Native Collectibles needs a protected read-only workspace and server route');
}

if (!existsSync(resolve(root,'app/api/mobile/global/write-capabilities/route.ts')) ||
    !read('mobile/src/app/global/provisions/new.tsx').includes('getGlobalManagementCapabilities') ||
    !read('lib/mobile/production-readonly.ts').includes('canRunMobileGlobalTenantOperations')) {
  blockers.push('Native tenant provisioning/management needs independent global server grants');
}
if (!existsSync(resolve(root,'app/api/mobile/global/maintenance/route.ts')) ||
    !existsSync(resolve(root,'mobile/src/app/global/maintenance.tsx')) ||
    !gate.includes('canRunMobileGlobalMaintenanceWrites') ||
    !read('lib/maintenance/rules.ts').includes("path === '/api/mobile/global/maintenance'")) {
  blockers.push('Global Maintenance requires protected native schedule and recovery controls');
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
const profileUat = eas.build?.['v15-uat'];
const prodAab = eas.build?.production;
const prodUrl = 'https://clearsys.vercel.app/api/mobile';
if (profileUat?.distribution !== 'internal' || profileUat.android?.buildType !== 'apk' ||
    profileUat.env?.EXPO_PUBLIC_API_URL !== prodUrl ||
    profileUat.env?.EXPO_PUBLIC_CLEAR_RELEASE_KIND !== 'v15-production-uat' ||
    profileUat.env?.EXPO_PUBLIC_CLEAR_TENANT_OPERATIONS !== 'false' ||
    profileUat.env?.EXPO_PUBLIC_CLEAR_STUDENT_ROSTER_WRITES !== 'true') {
  blockers.push('APK UAT must target the pinned Production HTTPS API with independently granted student roster editing');
}
if (prodAab?.android?.buildType !== 'app-bundle' ||
    prodAab.env?.EXPO_PUBLIC_API_URL !== prodUrl ||
    prodAab.env?.EXPO_PUBLIC_CLEAR_RELEASE_KIND !== 'v15-production' ||
    prodAab.env?.EXPO_PUBLIC_CLEAR_TENANT_OPERATIONS !== 'false' ||
    prodAab.env?.EXPO_PUBLIC_CLEAR_STUDENT_ROSTER_WRITES !== 'true') {
  blockers.push('Play AAB must match the approved APK role, roster and read-only finance policy');
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
