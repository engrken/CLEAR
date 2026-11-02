import { handler, preflight } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { hasTabAccess, isAdminRole } from '@/lib/roles';
import { canRunMobileRosterWrites, mobileRosterWriteEnvironment, canRunMobileTenantUserWrites, mobileTenantUserWriteEnvironment, canRunMobileTenantUserManageWrites, canRunMobileAcademicSettingsWrites } from '@/lib/mobile/production-readonly';

type Ctx = { params: Promise<{ org: string }> };

/**
 * Explicit authenticated capability response. This is intentionally deny-all
 * until audited server-side action authorization and transaction routes exist.
 * Never derive write privileges from allowedTabs or from an Android flag.
 */
export const GET = handler(async (req, { params }: Ctx) => {
  const { org } = await params;
  const { officer, org: tenant } = await requireMobileOfficer(req, org, []);
  const rosterEnabled = canRunMobileRosterWrites(mobileRosterWriteEnvironment()) &&
    hasTabAccess(officer.role, officer.allowedTabs, 'tab-students');
  const usersEnabled = canRunMobileTenantUserWrites(mobileTenantUserWriteEnvironment()) &&
    isAdminRole(officer.role) &&
    hasTabAccess(officer.role, officer.allowedTabs, 'tab-users');
  const manageEnabled = usersEnabled && canRunMobileTenantUserManageWrites(mobileTenantUserWriteEnvironment());
  const calendarEnabled = canRunMobileAcademicSettingsWrites(mobileTenantUserWriteEnvironment()) &&
    isAdminRole(officer.role) && hasTabAccess(officer.role, officer.allowedTabs, 'tab-setup');
  if (!rosterEnabled && !usersEnabled && !manageEnabled && !calendarEnabled) return { enabled: false, grants: [] };
  return { enabled: true, grants: [
    ...(rosterEnabled ? ['students.create', 'students.update', 'students.enrollment'] : []),
    ...(usersEnabled ? ['tenant.users.status'] : []),
    ...(manageEnabled ? ['tenant.users.manage', 'tenant.roles.manage'] : []),
    ...(calendarEnabled ? ['tenant.settings.manage'] : []),
  ].map(action => ({ action, organization: tenant.subdomain })) };
});

export const OPTIONS = preflight;
