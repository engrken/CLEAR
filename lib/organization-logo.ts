/**
 * Display-only fallback for a tenant without a saved organization logo.
 * Do not persist this path to Organization.logo: custom uploads retain priority.
 */
export const DEFAULT_ORGANIZATION_LOGO = '/clearsys.png';

export function getOrganizationLogoSrc(logo: string | null | undefined): string {
  return typeof logo === 'string' && logo.trim()
    ? logo.trim()
    : DEFAULT_ORGANIZATION_LOGO;
}
