// Unit tests for the demo reviewer gate (lib/demo-reviewer.ts) with explicit
// env objects, including the "flag off" cases the running server can't show.
// No server or database needed (npm run test:api loads .ts via --experimental-strip-types).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_ORG_SLUG, demoReviewerCode, isDemoReviewerEnabled } from '../../lib/demo-reviewer.ts';

const ON = { DEMO_REVIEWER_EMAIL: 'Reviewer@Demo.Clear.Invalid ', DEMO_REVIEWER_CODE: ' 135790' };
const EMAIL = 'reviewer@demo.clear.invalid';

describe('demoReviewerCode', () => {
  it('returns the code for the demo email in the demo org (trimmed, case-insensitive)', () => {
    assert.equal(DEMO_ORG_SLUG, 'demo');
    assert.equal(demoReviewerCode('demo', EMAIL, ON), '135790');
    assert.equal(demoReviewerCode(' DEMO ', ' REVIEWER@demo.clear.invalid', ON), '135790');
  });

  it('is off by default and when either variable is missing or blank', () => {
    assert.equal(isDemoReviewerEnabled({}), false);
    assert.equal(demoReviewerCode('demo', EMAIL, {}), null);
    assert.equal(demoReviewerCode('demo', EMAIL, { DEMO_REVIEWER_EMAIL: EMAIL }), null);
    assert.equal(demoReviewerCode('demo', EMAIL, { DEMO_REVIEWER_CODE: '135790' }), null);
    assert.equal(demoReviewerCode('demo', EMAIL, { DEMO_REVIEWER_EMAIL: ' ', DEMO_REVIEWER_CODE: '135790' }), null);
  });

  it('is off when the code is not exactly 6 digits', () => {
    for (const code of ['', '12345', '1234567', 'abcdef', '12 456', '１２３４５６']) {
      assert.equal(demoReviewerCode('demo', EMAIL, { DEMO_REVIEWER_EMAIL: EMAIL, DEMO_REVIEWER_CODE: code }), null, code);
    }
  });

  it('never applies to another org', () => {
    for (const org of ['devdept', 'demo2', 'demo-org', 'xdemo', '', 'dem0']) {
      assert.equal(demoReviewerCode(org, EMAIL, ON), null, org);
    }
  });

  it('never applies to another email', () => {
    for (const email of ['', 'reviewer@demo.clear.invalid.evil.com', 'xreviewer@demo.clear.invalid', 'reviewer@demo.clear', 'admin@demo.clear.invalid']) {
      assert.equal(demoReviewerCode('demo', email, ON), null, email);
    }
  });
});
