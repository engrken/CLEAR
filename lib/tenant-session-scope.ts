/**
 * Prevent a tenant session issued for one organization from being reused
 * against another tenant, even if the same email exists in both rosters.
 * Global administrators are validated separately before this check.
 */
export function assertTenantSessionScope(
  sessionOrganizationId: unknown,
  targetOrganizationId: unknown
): void {
  if (
    typeof sessionOrganizationId !== 'string' ||
    typeof targetOrganizationId !== 'string' ||
    !sessionOrganizationId ||
    !targetOrganizationId ||
    sessionOrganizationId !== targetOrganizationId
  ) {
    throw new Error('403 Forbidden: Session does not belong to this department.');
  }
}
