import 'server-only';
import { prisma } from '@/lib/prisma';
import { consumeWebHandoffTicket } from '@/lib/mobile/web-handoff-store';
import { isWebHandoffEnabled } from '@/lib/mobile/web-handoff-issue';
import { effectiveTabs, isOrganizationActive } from '@/lib/roles';
import { verifyGlobalAdminSession } from '@/lib/super-admin';
import { maintenanceForTenant } from '@/lib/maintenance/service';

/** Redeems before creating a web session; failures burn the ticket, never retry it. */
export async function redeemWebHandoff(ticket: string) {
  if (!isWebHandoffEnabled()) return null;
  const secret = process.env.MOBILE_WEB_HANDOFF_SECRET;
  if (!secret || secret.length < 32) return null;
  const record = await consumeWebHandoffTicket(ticket, secret);
  if (!record) return null;
  const now = new Date();
  if (record.principalType === 'officer' && record.organizationId) {
    const session = await prisma.mobileSession.findUnique({ where: { id: record.mobileSessionId } });
    if (!session || session.revokedAt || session.expiresAt <= now ||
        session.tenantUserId !== record.principalId || session.organizationId !== record.organizationId) return null;
    const user = await prisma.tenantUser.findUnique({ where: { id: record.principalId }, include: { organization: true } });
    if (!user || user.status !== 'Active' || user.organizationId !== record.organizationId ||
        !isOrganizationActive(user.organization) ||
        record.destination !== `/department/${user.organization.subdomain}`) return null;
    const maintenance = await maintenanceForTenant(user.organization.subdomain);
    if (maintenance.mode === 'FULL') return null;
    return { id: user.id, name: user.fullName, email: user.email, role: user.role,
      organizationId: user.organizationId, department: user.organization.subdomain,
      username: user.username, allowedTabs: effectiveTabs(user.role, user.allowedTabs) };
  }
  if (record.principalType === 'global' && !record.organizationId && record.destination === '/dashboard/provisions') {
    const session = await prisma.globalMobileSession.findUnique({ where: { id: record.mobileSessionId } });
    if (!session || session.revokedAt || session.expiresAt <= now || session.globalAdminId !== record.principalId) return null;
    const identity = await verifyGlobalAdminSession({ email: session.adminEmail,
      role: 'SuperAdmin', globalAdminId: session.globalAdminId,
      globalAdminVersion: session.globalAdminVersion });
    if (!identity) return null;
    return { id: identity.id, name: identity.fullName, email: identity.email, role: 'SuperAdmin',
      globalAdminId: identity.id, globalAdminVersion: identity.sessionVersion,
      organizationId: null, department: null, username: 'SuperAdmin',
      allowedTabs: ['tab-overview', 'tab-students', 'tab-clearance', 'tab-payment', 'tab-remittances', 'tab-penalties', 'tab-advances', 'tab-audit', 'tab-collectibles', 'tab-reports', 'tab-void', 'tab-report', 'tab-transfer', 'tab-users', 'tab-setup'] };
  }
  return null;
}
