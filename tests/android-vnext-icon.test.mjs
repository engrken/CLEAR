import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url));
const text = (p) => read(p).toString('utf8');

test('next Android release tracks distinct launcher and adaptive foreground within source tree', () => {
  const config = JSON.parse(text('mobile/app.json')).expo;
  assert.equal(config.icon, './assets/clear-launcher-vnext.png');
  assert.equal(config.android.adaptiveIcon.foregroundImage, './assets/clear-adaptive-foreground-vnext.png');
  assert.equal(config.android.adaptiveIcon.backgroundColor, '#FFFFFF');
  for (const path of [config.icon, config.android.adaptiveIcon.foregroundImage]) {
    const png = read('mobile/' + path.slice(2));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), png.readUInt32BE(20));
    assert.ok(png.readUInt32BE(16) >= 128);
  }
  assert.equal(config.version, '1.5.0');
  assert.equal(config.android.versionCode, 16, 'candidate only: verify all Play tracks below 16');
});

test('Play release gates require approved full-resolution original artwork', () => {
  const verifier = text('mobile/scripts/verify-live-viewer.mjs');
  assert.match(verifier, /process\.argv\.includes\('--release'\)/);
  assert.match(verifier, /asset\.width, 1024/);
  assert.match(verifier, /createHash\('sha256'\)/);
  assert.match(verifier, /assert\.notEqual\(iconPath, adaptivePath/);
  assert.match(verifier, /PAYMENT_WRITES_ENABLED = false/);
  assert.match(verifier, /MOBILE_BUSINESS_WRITES_ENABLED = false/);
  const guide = text('docs/android-vnext-icon-release.md');
  assert.match(guide, /full-resolution originals are already checked into GitHub/);
  assert.match(guide, /verify-live-viewer\.mjs/);
});

test('workstation signed AAB verifier validates official bundletool and retains proper release identity checks', () => {
  const verify = text('mobile/scripts/Verify-ClearAndroidAAB.ps1');
  assert.match(verify, /bundletool-all-1\.18\.3\.jar/);
  assert.match(verify, /expectedToolHash/);
  assert.match(verify, /bundletool validate/);
  assert.match(verify, /jarsigner -verify/);
  assert.match(verify, /signed in JarFile but is not signed in JarInputStream/);
  assert.match(verify, /com\.rupertbulquerin\.clear/);
  assert.match(verify, /'1\.3\.0'/);
  assert.match(verify, /MinVersionCode/);
  assert.match(verify, /-lt 36/);
});

test('v1.2.4 clean native launcher regeneration guards against old icon reuse', () => {
  const prepare = text('mobile/scripts/Prepare-ClearAndroidV124.ps1');
  const workflow = text('.github/workflows/android-gradle-validation.yml');
  assert.match(prepare, /old android\/ directory/);
  assert.match(prepare, /-ne '1\.2\.4'/);
  assert.match(prepare, /versionCode -ne 14/);
  assert.match(prepare, /Test-Path -LiteralPath \$Workspace/);
  assert.match(prepare, /verify-live-viewer\.mjs/);
  assert.match(prepare, /npx expo prebuild --platform android --clean --no-install/);
  assert.match(prepare, /ic_launcher_foreground/);
  assert.match(prepare, /clear-native-launcher-resources\.sha256\.txt/);
  // The release must never accept debug signing as a valid Play Upload identity.
  assert.match(prepare, /signingConfigs\.release/);
  assert.match(prepare, /:app:signingReport/);
  assert.match(prepare, /private Play Upload signing/);
  assert.match(workflow, /npx expo prebuild --platform android --clean/);
  assert.match(workflow, /Verify generated adaptive launcher sources/);
});
