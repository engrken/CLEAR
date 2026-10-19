/** Pure policy for promoting an existing tenant identity to a global operator.
 * Existing tenant records are retained; global credentials take precedence.
 */
export type TenantMembershipForPromotion = {
  id: string;
  organizationId: string;
  status: string;
  role: string;
};
export type AdminCandidateForPromotion = TenantMembershipForPromotion & {
  email: string;
  reservedGlobalAdmin: boolean;
};

const admin = (role: string) =>
  ['admin', 'administrator', 'master'].includes(role.trim().toLowerCase());

export function validateTenantPromotion(
  memberships: TenantMembershipForPromotion[],
  otherUsers: AdminCandidateForPromotion[],
): string | null {
  if (!memberships.length) {
    return 'No tenant membership exists for this email. Invite them as a new global administrator instead.';
  }
  if (memberships.some(m => m.status !== 'Active')) {
    return 'All existing tenant memberships must be Active before promotion. Resolve inactive or blocked accounts first.';
  }
  for (const member of memberships) {
    if (!admin(member.role)) continue;
    const replacement = otherUsers.some(user =>
      user.organizationId === member.organizationId &&
      user.id !== member.id &&
      user.status === 'Active' &&
      admin(user.role) &&
      !user.reservedGlobalAdmin
    );
    if (!replacement) {
      return 'Promoting the last usable administrator of a department is not allowed. Appoint another active tenant administrator first.';
    }
  }
  return null;
}
