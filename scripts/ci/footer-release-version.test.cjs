const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('package, lockfile and newest release note match', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  const releases = JSON.parse(read('data/releases.json'));
  assert.equal(pkg.version, lock.version);
  assert.equal(pkg.version, lock.packages[''].version);
  assert.equal(pkg.version, releases[0].version);
  assert.ok(releases[0].changes.length > 0);
  assert.match(pkg.scripts['version:fix'], /bump-release\.mjs fix/);
  assert.match(pkg.scripts['version:feature'], /bump-release\.mjs feature/);
  assert.match(pkg.scripts['version:major'], /bump-release\.mjs major/);
  assert.match(pkg.scripts.build, /test:release/);
});

test('SAGA-style beta version increments are explicit', async () => {
  const { nextReleaseVersion } = await import(pathToFileURL(path.join(root, 'scripts/bump-release.mjs')).href);
  assert.equal(nextReleaseVersion('1.0.1-beta.5', 'fix'), '1.0.1-beta.6');
  assert.equal(nextReleaseVersion('1.0.1-beta.5', 'feature'), '1.1.0-beta.1');
  assert.equal(nextReleaseVersion('1.0.1-beta.5', 'major'), '2.0.0-beta.1');
  assert.equal(nextReleaseVersion('1.4.0', 'fix'), '1.4.1-beta.1');
  assert.throws(() => nextReleaseVersion('bad', 'fix'));
  assert.throws(() => nextReleaseVersion('1.2.3', 'other'));
});

test('department footer uses package release, deployed SHA, and release notes', () => {
  const footer = read('app/department/[department]/components/Footer.tsx');
  const layout = read('app/department/[department]/layout.tsx');
  assert.match(footer, /packageJson\.version/);
  assert.match(footer, /href="\/updates"/);
  assert.match(footer, /Privacy Notice/);
  assert.match(footer, /buildId/);
  assert.doesNotMatch(footer, /RELEASE_VERSION\s*=/);
  assert.match(layout, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(layout, /<Footer buildId=/);
});

test('What is New page shows package version, build and release history', () => {
  const page = read('app/updates/page.tsx');
  assert.match(page, /packageJson\.version/);
  assert.match(page, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(page, /releases\.map\(/);
  assert.match(page, /Asia\/Manila/);
});
