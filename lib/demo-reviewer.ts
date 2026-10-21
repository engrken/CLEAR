/** Reviewer bypass is deliberately disabled until an isolated review environment is provisioned. */
export const DEMO_ORG_SLUG = 'demo';
export function isDemoReviewerEnabled(): boolean { return false; }
export function demoReviewerCode(_organizationSlug: string, _email: string): string | null { return null; }
