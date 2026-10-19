'use server';

import { Prisma } from '@prisma/client';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { signOut } from '@/auth';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin, isReservedGlobalAdminEmail } from '@/lib/permissions';
import { PRESET_ROLE_TABS } from '@/lib/role-permissions';
import { academicYearStart, isCalendarMode, periodsFor, type CalendarMode } from '@/lib/academic-periods';

export type SubscriptionTier = 'Freemium' | 'Pro' | 'Corporate';
export type OrganizationStatus = 'Active' | 'Inactive' | 'Archived';

const TIERS: SubscriptionTier[] = ['Freemium', 'Pro', 'Corporate'];
const STATUSES: OrganizationStatus[] = ['Active', 'Inactive', 'Archived'];
const GROUP_LIMIT: Record<SubscriptionTier, number> = {
  Freemium: 2,
  Pro: 10,
  Corporate: Number.MAX_SAFE_INTEGER,
};
const IDENTIFIER = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const RESERVED_SLUGS = new Set([
  'api', 'dashboard', 'department', 'admin', 'www', 'localhost', 'login', 'auth',
]);
const normal = (v: unknown) => String(v ?? '').trim();

function assertTier(value: unknown): SubscriptionTier {
  if (!TIERS.includes(value as SubscriptionTier)) throw new Error('Invalid subscription tier.');
  return value as SubscriptionTier;
}

function assertStatus(value: unknown): OrganizationStatus {
  if (!STATUSES.includes(value as OrganizationStatus)) throw new Error('Invalid organization status.');
  return value as OrganizationStatus;
}

function assertIdentifier(value: unknown, description: string): string {
  const cleaned = normal(value).toLowerCase();
  if (!IDENTIFIER.test(cleaned)) {
    throw new Error(`${description} must use lowercase letters, numbers and internal hyphens (1–63 characters).`);
  }
  return cleaned;
}

function assertOrgId(id: unknown): string {
  const result = normal(id);
  if (!result || result.length > 128) throw new Error('Invalid organization ID.');
  return result;
}

async function verifiedSuperAdminEmail(): Promise<string> {
  // Checks BOTH an authenticated SuperAdmin role and the configured master email.
  const user = await requireSuperAdmin();
  return String(user.email).trim().toLowerCase();
}

function refreshProvisioning() {
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/provisions');
  revalidatePath('/dashboard/entity/portal');
}

function handleDbError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') throw new Error('An entity or administrator with these identifiers already exists.');
    if (error.code === 'P2034') throw new Error('Another provisioning update occurred. Please retry your change.');
    if (error.code === 'P2003') throw new Error('This organization has related records that prevent deletion. Archive it instead.');
  }
  throw error;
}

/** Every grouped entity shares one tier, so count the whole group before changing tiers. */
function checkGroupLimit(count: number, tier: SubscriptionTier, group: string) {
  if (count > GROUP_LIMIT[tier]) {
    throw new Error(`School group '${group}' has ${count} entities, exceeding the ${tier} allowance of ${GROUP_LIMIT[tier]}. Upgrade the tier or move entities first.`);
  }
}

export async function provisionEntityWithTier(data: {
  name: string;
  subdomain: string;
  schoolGroup: string;
  tier: SubscriptionTier;
  type: string;
  adminEmail?: string;
  adminName?: string;
  adminUsername?: string;
  initialAcademicYear: string;
  calendarMode: CalendarMode;
  includeSummer: boolean;
}) {
  const actor = await verifiedSuperAdminEmail();
  const name = normal(data?.name);
  const subdomain = assertIdentifier(data?.subdomain, 'Subdomain');
  const schoolGroup = assertIdentifier(data?.schoolGroup || 'default-school', 'School group');
  const tier = assertTier(data?.tier);
  const type = normal(data?.type);
  const adminEmail = normal(data?.adminEmail).toLowerCase();
  const adminName = normal(data?.adminName);
  // The very first accounting period is fixed before any financial record exists.
  const initialAcademicYear = normal(data?.initialAcademicYear);
  academicYearStart(initialAcademicYear);
  if (!isCalendarMode(String(data?.calendarMode))) {
    throw new Error('Choose an academic calendar: Full-Year, Semester, or Trimester.');
  }
  const calendarMode = data.calendarMode;
  const includeSummer = calendarMode === 'Semester' && data.includeSummer === true;
  const initialTerm = periodsFor({ mode: calendarMode, includeSummer })[0];

  if (!name || name.length > 150) throw new Error('Entity name must be between 1 and 150 characters.');
  if (RESERVED_SLUGS.has(subdomain)) throw new Error('This subdomain is reserved. Choose another.');
  if (!['Department', 'Organization'].includes(type)) throw new Error('Invalid entity type.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail) || adminEmail.length > 254) {
    throw new Error('A valid administrator email address is required.');
  }
  if (!adminName || adminName.length > 150) throw new Error('Administrator name must be between 1 and 150 characters.');
  if (await isReservedGlobalAdminEmail(adminEmail)) {
    throw new Error('The system Super Admin cannot be provisioned as a tenant administrator.');
  }

  // New tenants have one initial owner, never a duplicate system-level SuperAdmin account.
  const baseUsername = adminEmail.split('@')[0].replace(/[^a-z0-9_-]/g, '') || 'admin';
  const suppliedUsername = normal(data?.adminUsername).toLowerCase();
  if (suppliedUsername && !/^[a-z0-9][a-z0-9_-]{1,59}$/.test(suppliedUsername)) {
    throw new Error('Administrator username must be 2–60 characters using letters, numbers, underscores, or hyphens.');
  }
  const username = suppliedUsername || `${baseUsername}_${subdomain}`.slice(0, 60);
  let createdId = '';

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.organization.findUnique({
        where: { subdomain }, select: { id: true },
      });
      if (existing) throw new Error(`Subdomain '${subdomain}' is already in use.`);

      let existingGroupMembers: { id: string; tier: string }[] = [];
      if (schoolGroup !== 'default-school') {
        existingGroupMembers = await tx.organization.findMany({
          where: { schoolGroup }, select: { id: true, tier: true },
        });
        if (existingGroupMembers.length) {
          const currentTiers = new Set(existingGroupMembers.map((member) => member.tier));
          if (currentTiers.size !== 1) {
            throw new Error(`School group '${schoolGroup}' has inconsistent tiers. Correct the group before adding tenants.`);
          }
          if (existingGroupMembers[0].tier !== tier) {
            throw new Error(`School group '${schoolGroup}' uses the ${existingGroupMembers[0].tier} tier. Select the same tier or explicitly change the group tier first.`);
          }
        }
        checkGroupLimit(existingGroupMembers.length + 1, tier, schoolGroup);
      }

      const entity = await tx.organization.create({
        data: {
          name, subdomain, schoolGroup, tier, type, status: 'Active',
          activeAy: initialAcademicYear, activeTerm: initialTerm,
        },
        select: { id: true },
      });
      createdId = entity.id;

      // One calendar record per organization/year. Provisioning and calendar creation
      // commit together; no tenant can start in an unintended 1st-semester default.
      await tx.academicPeriodConfig.create({
        data: {
          organizationId: entity.id,
          academicYear: initialAcademicYear,
          mode: calendarMode,
          includeSummer,
        },
      });

      // Do not implicitly upgrade or downgrade EXISTING group members while provisioning.
      // Changing a group's tier is a separate, explicit administrative action.

      await tx.tenantUser.create({
        data: {
          organizationId: entity.id,
          userId: `USR-${subdomain.toUpperCase()}-001`,
          fullName: adminName,
          username,
          email: adminEmail,
          role: 'admin',
          allowedTabs: JSON.stringify(PRESET_ROLE_TABS.admin),
          status: 'Active',
        },
      });

      await tx.systemLog.create({
        data: {
          organizationId: entity.id,
          user: actor,
          action: 'PROVISION_ENTITY',
          details: `Provisioned entity '${name}' (${subdomain}), group '${schoolGroup}', tier '${tier}', initial administrator '${adminEmail}'. Initial accounting calendar: ${initialAcademicYear} / ${calendarMode} / ${initialTerm} (summer: ${includeSummer}). Remaining setup: create fund pools and collection fees before collection operations.`,
        },
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000, timeout: 20000,
    });
  } catch (error) { handleDbError(error); }

  refreshProvisioning();
  return {
    success: true,
    organizationId: createdId,
    department: subdomain,
    academicYear: initialAcademicYear,
    activeTerm: initialTerm,
    message: 'Tenant, initial administrator, and accounting calendar created. Next: sign in to the tenant and configure fund pools and collection fees before processing payments.',
  };
}

export async function updateOrganizationTier(orgId: string, newTier: SubscriptionTier) {
  const actor = await verifiedSuperAdminEmail();
  const id = assertOrgId(orgId);
  const tier = assertTier(newTier);

  try {
    await prisma.$transaction(async (tx) => {
      const org = await tx.organization.findUnique({ where: { id } });
      if (!org) throw new Error('Organization not found.');

      const isNamedGroup = Boolean(org.schoolGroup && org.schoolGroup !== 'default-school');
      const affected = isNamedGroup
        ? await tx.organization.findMany({ where: { schoolGroup: org.schoolGroup }, select: { id: true } })
        : [{ id }];
      checkGroupLimit(affected.length, tier, org.schoolGroup || 'default-school');

      if (isNamedGroup) {
        await tx.organization.updateMany({ where: { schoolGroup: org.schoolGroup }, data: { tier } });
      } else {
        await tx.organization.update({ where: { id }, data: { tier } });
      }
      await tx.systemLog.createMany({
        data: affected.map((entry) => ({
          organizationId: entry.id,
          user: actor,
          action: 'CHANGE_ORGANIZATION_TIER',
          details: `Changed subscription tier to ${tier} for school group '${org.schoolGroup}'.`,
        })),
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
  } catch (error) { handleDbError(error); }
  refreshProvisioning();
  return { success: true };
}

export async function updateOrganizationStatus(orgId: string, newStatus: OrganizationStatus) {
  const actor = await verifiedSuperAdminEmail();
  const id = assertOrgId(orgId);
  const status = assertStatus(newStatus);

  try {
    await prisma.$transaction(async (tx) => {
      const original = await tx.organization.findUnique({ where: { id }, select: { id: true, status: true, subdomain: true } });
      if (!original) throw new Error('Organization not found.');
      if (original.status === status) return;
      await tx.organization.update({ where: { id }, data: { status } });
      await tx.systemLog.create({
        data: {
          organizationId: id, user: actor, action: 'CHANGE_ORGANIZATION_STATUS',
          details: `Changed '${original.subdomain}' from '${original.status}' to '${status}'.`,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
  } catch (error) { handleDbError(error); }
  refreshProvisioning();
  return { success: true };
}

export async function updateOrganizationSchoolGroup(orgId: string, newGroup: string) {
  const actor = await verifiedSuperAdminEmail();
  const id = assertOrgId(orgId);
  const schoolGroup = assertIdentifier(newGroup || 'default-school', 'School group');

  try {
    await prisma.$transaction(async (tx) => {
      const org = await tx.organization.findUnique({ where: { id } });
      if (!org) throw new Error('Organization not found.');
      if (org.schoolGroup === schoolGroup) return;

      // A transferred entity adopts the target group's common tier. A group cannot exceed its cap.
      let targetTier = assertTier(org.tier);
      if (schoolGroup !== 'default-school') {
        const members = await tx.organization.findMany({
          where: { schoolGroup }, select: { tier: true },
        });
        if (members.length) {
          const tiers = new Set(members.map((item) => item.tier));
          if (tiers.size !== 1) {
            throw new Error('Target group has inconsistent subscription tiers. Reconcile its tier before moving entities.');
          }
          targetTier = assertTier(members[0].tier);
        }
        checkGroupLimit(members.length + 1, targetTier, schoolGroup);
      }

      await tx.organization.update({ where: { id }, data: { schoolGroup, tier: targetTier } });
      await tx.systemLog.create({
        data: {
          organizationId: id, user: actor, action: 'MOVE_ORGANIZATION_GROUP',
          details: `Moved '${org.subdomain}' from '${org.schoolGroup}' to '${schoolGroup}' (tier '${targetTier}').`,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
  } catch (error) { handleDbError(error); }
  refreshProvisioning();
  return { success: true };
}

/** Only completely unused entities can be deleted. Archive all entities with operational records. */
export async function deleteOrganization(orgId: string) {
  await verifiedSuperAdminEmail();
  const id = assertOrgId(orgId);

  try {
    await prisma.$transaction(async (tx) => {
      const org = await tx.organization.findUnique({ where: { id }, select: { id: true, subdomain: true } });
      if (!org) throw new Error('Organization not found.');
      const scope = { organizationId: id };
      const counts = await Promise.all([
        tx.student.count({ where: scope }),
        tx.enrollment.count({ where: scope }),
        tx.collection.count({ where: scope }),
        tx.collectionSetup.count({ where: scope }),
        tx.collectible.count({ where: scope }),
        tx.fund.count({ where: scope }),
        tx.fundTransfer.count({ where: scope }),
        tx.fundRealignment.count({ where: scope }),
        tx.penalty.count({ where: scope }),
        tx.cashAdvance.count({ where: scope }),
        tx.audit.count({ where: scope }),
        tx.expenseItem.count({ where: scope }),
        tx.onlineRemittance.count({ where: scope }),
        tx.cashierRemittance.count({ where: scope }),
        tx.voidTransaction.count({ where: scope }),
      ]);
      if (counts.some((count) => count > 0)) {
        throw new Error('Cannot permanently delete an organization with existing student or financial records. Change its status to Archived instead.');
      }
      // A pristine entity contains only its initial administrator, branding and provisioning log.
      await tx.organization.delete({ where: { id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
  } catch (error) { handleDbError(error); }
  refreshProvisioning();
  return { success: true, message: 'Unused entity permanently deleted.' };
}

/** Log out of both the separate entity portal and the NextAuth Super Admin session. */
export async function logoutProvisioningAction() {
  const store = await cookies();
  store.delete('clear_entity_session');
  await signOut({ redirectTo: '/dashboard' });
}
