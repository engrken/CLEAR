// Offline, dependency-free verification of the EAS Production internal viewer.
// This does NOT trigger builds or claim the backend is deployed or phone QA done.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = (p) => readFileSync(resolve(root, p), 'utf8');
const eas = JSON.parse(load('eas.json'));
const preview = eas.build.preview;
const internal = eas.build['live-readonly-internal'];
const prod = eas.build.production;
const canonical = 'https://clearsys.vercel.app/api/mobile';
const previewAlias = 'https://clearsys-git-android-parity-integration-kentbsece-7567.vercel.app/api/mobile';
assert.ok(internal && preview && prod, 'Never replace existing profiles');
assert.equal(internal.distribution, 'internal');
assert.equal(internal.android.buildType, 'apk');
assert.equal(internal.environment, 'production');
assert.equal(internal.env.EXPO_PUBLIC_API_URL, canonical);
assert.equal(internal.env.EXPO_PUBLIC_CLEAR_RELEASE_KIND, 'live-readonly-internal');
assert.equal(internal.autoIncrement, true);
assert.equal(preview.env.EXPO_PUBLIC_API_URL, previewAlias, 'Release 1.2.0 Preview must remain isolated');
assert.equal(preview.android.buildType, 'apk');
assert.equal(prod.android.buildType, 'app-bundle', 'Do not alter Play Store artifact');
assert.equal(prod.env.EXPO_PUBLIC_API_URL, canonical);
const cfg = load('src/api/config.ts');
assert.match(cfg, /export const PAYMENT_WRITES_ENABLED = false;/);
assert.match(cfg, /export const REMITTANCE_WRITES_ENABLED = false;/);
assert.match(cfg, /STUDENT_ROSTER_WRITES_ENABLED = process\.env\.EXPO_PUBLIC_CLEAR_STUDENT_ROSTER_WRITES/);
assert.match(cfg, /STUDENT_ROSTER_WRITES_ENABLED !== false/);
assert.match(cfg, /export const MOBILE_BUSINESS_WRITES_ENABLED = false;/);
assert.match(cfg, /releaseKind === 'live-readonly-internal'/);
assert.match(cfg, /apiUrl !== PROD_URL/);
assert.match(cfg, /configuredMode === 'mock'/);
assert.match(cfg, /if \(!__DEV__\)/);
const http = load('src/api/http.ts');
assert.match(http, /MOBILE_BUSINESS_WRITES_ENABLED\s*\?/);
assert.match(http, /recordPayment:\s*\(s, p\) => \{\s*if \(!PAYMENT_WRITES_ENABLED\)/);
assert.match(http, /verifyRemittance:\s*\(s, id, p\) => REMITTANCE_WRITES_ENABLED\s*\?/);
assert.match(http, /invalidateRemittance:\s*\(s, id\) => REMITTANCE_WRITES_ENABLED\s*\?/);
const app = JSON.parse(load('app.json'));
assert.ok(/^com\.[A-Za-z0-9_.]+$/.test(app.expo.android.package), 'App ID must be explicit');
assert.match(app.expo.version, /^\d+\.\d+\.\d+$/, 'Android release version must be semantic major.minor.patch');
assert.equal(app.expo.android.package, 'com.rupertbulquerin.clear', 'Play app identity must remain unchanged');
assert.equal(app.expo.owner, 'rupert2133s-team', 'Expo project owner must remain unchanged');
// Distinct icons prevent Android circle/squircle masks clipping launcher art.
const iconPath = app.expo.icon;
const adaptivePath = app.expo.android.adaptiveIcon.foregroundImage;
function readPngAsset(path, label) {
  assert.ok(path.startsWith('./assets/') && /^[A-Za-z0-9._-]+[.]png$/.test(path.slice('./assets/'.length)), label + ' must be bundled in mobile/assets');
  const bytes = readFileSync(resolve(root, path));
  assert.ok(bytes.length > 1024, label + ' must contain real PNG image data');
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', label + ' must be a PNG');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  assert.ok(width >= 128 && height >= 128 && width === height, label + ' must be square and at least 128px');
  return { bytes, width };
}
const launcher = readPngAsset(iconPath, 'Launcher');
const adaptive = readPngAsset(adaptivePath, 'Adaptive foreground');
assert.notEqual(iconPath, adaptivePath, 'Adaptive foreground must use its own safely padded image');
assert.equal(app.expo.android.adaptiveIcon.backgroundColor, '#FFFFFF', 'Expected approved white adaptive-icon background');

// Explicit release gate: 128px compact design-preview assets are not ready
// for a final signed Play build. Owner must replace BOTH files with the
// independently approved 1024px source assets before --release can pass.
if (process.argv.includes('--release')) {
  const expected = {
    [iconPath]: 'c1deff4bd85750a7779b566377727a83fcb7bbc1512790e8df8f93c4ebe67fc4',
    [adaptivePath]: '23598d480fd8fe054cae0d52bf259824f20b9bf21830c4d060532cd35d72b30b',
  };
  for (const [path, asset] of [[iconPath, launcher], [adaptivePath, adaptive]]) {
    assert.equal(asset.width, 1024, path + ' must use full-resolution release artwork');
    assert.equal(createHash('sha256').update(asset.bytes).digest('hex'), expected[path], path + ' must match approved source artwork');
  }
}
console.log('PASS: internal live-viewer APK profile is pinned to Production, isolated from Preview, and business writes remain disabled.');
