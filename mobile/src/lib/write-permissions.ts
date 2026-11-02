/**
 * CLEAR Android v1.5.0 — explicit, fail-closed transaction authorization.
 *
 * A visible module grant is NOT a write grant. Only server-issued action grants
 * may authorize a client to show a write control; the backend MUST independently
 * verify the authenticated actor, organization, action and record on every request.
 * Financial and tenant writes remain disabled until their endpoints are audited.
 */
export const MOBILE_WRITE_ACTIONS = [
  'clearance.update',
  'collections.create',
  'students.update',
  'students.enrollment',
  'penalties.assess',
  'penalties.adjust',
  'advances.create',
  'advances.approve',
  'advances.release',
  'liquidations.submit',
  'liquidations.approve',
  'liquidations.reconcile',
  'remittances.create',
  'remittances.verify',
  'remittances.invalidate',
  'receipts.void',
  'maintenance.manage',
  'tenant.users.manage',
  'tenant.roles.manage',
  'tenant.settings.manage',
  'global.tenants.manage',
] as const;

export type MobileWriteAction = (typeof MOBILE_WRITE_ACTIONS)[number];

export type MobileWriteGrant = Readonly<{
  action: MobileWriteAction;
  organization: string;
}>;

export type MobileWritePolicy = Readonly<{
  /** Explicit server-issued grants for the currently authenticated principal. */
  grants: readonly MobileWriteGrant[];
  /** Server-side deployment gate, not an Android build-time permission. */
  enabled: boolean;
}>;

const validActions: ReadonlySet<string> = new Set(MOBILE_WRITE_ACTIONS);

export function canOfferMobileWrite(
  policy: MobileWritePolicy | null | undefined,
  action: MobileWriteAction,
  organization: string,
): boolean {
  if (!policy?.enabled || !validActions.has(action)) return false;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(organization)) return false;
  if (!Array.isArray(policy.grants)) return false;
  return policy.grants.some((grant) =>
    grant != null && grant.action === action && grant.organization === organization
  );
}
