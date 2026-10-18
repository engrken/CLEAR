// /lib/demo-reviewer.ts
//
// Google Play review access. Reviewers can't read an officer's inbox, so when
// DEMO_REVIEWER_EMAIL and DEMO_REVIEWER_CODE are both set, the demo officer of
// the `demo` organization (prisma/seed-demo.js, fake data only) is issued that
// fixed code instead of an emailed one. Everything else stays the same
// (lib/otp.ts): the code is still issued by request-code, stored hashed, expires
// in 5 minutes, is single use and counts toward the lockout.
//
// Off unless both variables are set. Never applies to another email, or to that
// email in another organization.
//
// No imports, so tests/mobile-api/demo-gate.test.mjs can load it directly.

export const DEMO_ORG_SLUG = 'demo';

type Env = Record<string, string | undefined>;

export function demoReviewerConfig(env: Env = process.env): { email: string; code: string } | null {
  const email = String(env.DEMO_REVIEWER_EMAIL || '').trim().toLowerCase();
  const code = String(env.DEMO_REVIEWER_CODE || '').trim();
  if (!email || !/^\d{6}$/.test(code)) return null;
  return { email, code };
}

export function isDemoReviewerEnabled(env: Env = process.env) {
  return demoReviewerConfig(env) !== null;
}

/** The fixed code for the demo officer of the demo org; null for every other sign-in. */
export function demoReviewerCode(orgSlug: string, email: string, env: Env = process.env): string | null {
  const config = demoReviewerConfig(env);
  if (!config) return null;
  if (String(orgSlug || '').trim().toLowerCase() !== DEMO_ORG_SLUG) return null;
  if (String(email || '').trim().toLowerCase() !== config.email) return null;
  return config.code;
}
