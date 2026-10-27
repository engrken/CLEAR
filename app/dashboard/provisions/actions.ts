'use server';

import { Prisma } from '@prisma/client';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { signOut } from '@/auth';
import { prisma } from '@/lib/prisma';
import { assertMaintenanceWritesAllowed } from '@/lib/maintenance/service';
import { requireSuperAdmin } from '@/lib/permissions';
import { provisionEntityWithTierCore, updateOrganizationTierCore, updateOrganizationStatusCore, updateOrganizationSchoolGroupCore } from '@/lib/provisioning/core';


export type SubscriptionTier = 'Freemium' | 'Pro' | 'Corporate';
export type OrganizationStatus = 'Active' | 'Inactive' | 'Archived';

const normal = (v: unknown) => String(v ?? '').trim();

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

/** Shared provisioning core: the web and mobile apply the same checks. */
export async function provisionEntityWithTier(data: Parameters<typeof provisionEntityWithTierCore>[1]) {
  const result = await provisionEntityWithTierCore(await verifiedSuperAdminEmail(), data);
  refreshProvisioning();
  return result;
}
export async function updateOrganizationTier(orgId: string, newTier: SubscriptionTier) {
  const result = await updateOrganizationTierCore(await verifiedSuperAdminEmail(), orgId, newTier);
  refreshProvisioning();
  return result;
}
export async function updateOrganizationStatus(orgId: string, newStatus: OrganizationStatus) {
  const result = await updateOrganizationStatusCore(await verifiedSuperAdminEmail(), orgId, newStatus);
  refreshProvisioning();
  return result;
}
export async function updateOrganizationSchoolGroup(orgId: string, newGroup: string) {
  const result = await updateOrganizationSchoolGroupCore(await verifiedSuperAdminEmail(), orgId, newGroup);
  refreshProvisioning();
  return result;
}

/** Only completely unused entities can be deleted. Archive all entities with operational records. */
export async function deleteOrganization(orgId: string) {
  await verifiedSuperAdminEmail();
  const id = assertOrgId(orgId);

  try {
    await prisma.$transaction(async (tx) => {
      const org = await tx.organization.findUnique({ where: { id }, select: { id: true, subdomain: true } });
      if (!org) throw new Error('Organization not found.');
      await assertMaintenanceWritesAllowed([org.subdomain], tx);
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
