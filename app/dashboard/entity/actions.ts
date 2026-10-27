// /app/dashboard/entity/actions.ts

'use server';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { signOut } from '@/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAuthenticatedEntityAdmin } from '@/lib/entity-session';
import { assertMaintenanceWritesAllowed } from '@/lib/maintenance/service';
import { PRESET_ROLE_TABS } from '@/lib/role-permissions';

const DEFAULT_GROUP = 'default-school';
const RESERVED = new Set(['api', 'dashboard', 'department', 'admin', 'www', 'localhost', 'login', 'auth']);

function normalizeSlug(value: unknown, field: string): string {
  const slug = String(value ?? '').trim().toLowerCase();

  if (
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)
  ) {
    throw new Error(
      `${field} must contain lowercase letters, numbers, and internal hyphens only.`
    );
  }

  return slug;
}

function getMaxEntities(tier: string): number {
  switch (tier) {
    case 'Freemium':
      return 2;
    case 'Pro':
      return 10;
    case 'Corporate':
      return Number.MAX_SAFE_INTEGER;
    default:
      throw new Error('The current subscription tier is invalid.');
  }
}

/**
 * Provisions a child organization and creates its owner account.
 *
 * The owner is the only tenant user automatically created in the
 * new organization. Additional officer accounts are created explicitly
 * through User Management.
 */
export async function provisionSubEntityAction(formData: FormData) {
  const session = await getAuthenticatedEntityAdmin();

  if (!session) {
    throw new Error(
      'Unauthorized: Your Entity Admin session is invalid or expired. Sign in again.'
    );
  }

  if (
    session.isSuperAdmin ||
    !session.tenantUserId ||
    !session.organizationId
  ) {
    throw new Error(
      'Use the Master Provisions Panel to create organizations as Super Admin.'
    );
  }
  await assertMaintenanceWritesAllowed(session.subdomain ? [session.subdomain] : []);

  const name = String(formData.get('name') ?? '').trim();
  const subdomain = normalizeSlug(
    formData.get('subdomain'),
    'Subdomain'
  );
  if (RESERVED.has(subdomain)) throw new Error('Reserved subdomain. Choose another.');

  const rawType = String(
    formData.get('type') ?? 'Department'
  ).trim();

  if (!name || name.length > 150) {
    throw new Error('Entity name is required and cannot exceed 150 characters.');
  }

  if (!['Department', 'Organization'].includes(rawType)) {
    throw new Error('Invalid entity type.');
  }

  const suppliedGroup = String(
    formData.get('schoolGroup') ?? ''
  ).trim().toLowerCase();

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // Revalidate the exact account and organization from the signed session.
        const owner = await tx.tenantUser.findFirst({
          where: {
            id: session.tenantUserId!,
            organizationId: session.organizationId!,
            email: {
              equals: session.email,
              mode: 'insensitive',
            },
            status: 'Active',
          },
          include: {
            organization: true,
          },
        });

        if (
          !owner ||
          !['admin', 'administrator'].includes(
            String(owner.role).trim().toLowerCase()
          )
        ) {
          throw new Error(
            'Your active organization administrator account could not be verified.'
          );
        }

        if (owner.organization.status !== 'Active') {
          throw new Error(
            'Your organization is inactive and cannot provision entities.'
          );
        }

        const currentGroup =
          String(owner.organization.schoolGroup || DEFAULT_GROUP)
            .trim()
            .toLowerCase();

        const currentTier = owner.organization.tier || 'Freemium';
        const maxAllowed = getMaxEntities(currentTier);

        const existingSlug = await tx.organization.findUnique({
          where: { subdomain },
          select: { id: true },
        });

        if (existingSlug) {
          throw new Error(
            `The subdomain '/department/${subdomain}' is already in use.`
          );
        }

        let targetGroup = currentGroup;

        // An ungrouped tenant must establish a new, unused institutional
        // group instead of joining an arbitrary existing group's records.
        if (currentGroup === DEFAULT_GROUP) {
          if (!suppliedGroup) {
            throw new Error(
              'Provide an institutional group ID before creating a child entity.'
            );
          }

          const requestedGroup = normalizeSlug(
            suppliedGroup,
            'Institutional group ID'
          );

          if (requestedGroup === DEFAULT_GROUP) {
            throw new Error(
              'Choose a new institutional group ID instead of default-school.'
            );
          }

          const groupAlreadyExists = await tx.organization.count({
            where: {
              schoolGroup: requestedGroup,
            },
          });

          if (groupAlreadyExists > 0) {
            throw new Error(
              'That institutional group ID is already in use. You cannot join an existing group by entering its ID.'
            );
          }

          targetGroup = requestedGroup;

          // This update is in the same transaction as child creation.
          // If provisioning fails, the group assignment rolls back too.
          await tx.organization.update({
            where: {
              id: owner.organizationId,
            },
            data: {
              schoolGroup: targetGroup,
            },
          });
        } else if (
          suppliedGroup &&
          suppliedGroup !== currentGroup
        ) {
          throw new Error(
            'You cannot change an existing organizations group through child provisioning.'
          );
        }

        if (currentGroup !== DEFAULT_GROUP) {
          const groupMembers = await tx.organization.findMany({
            where: { schoolGroup: targetGroup }, select: { tier: true },
          });
          if (groupMembers.some(member => member.tier !== currentTier)) {
            throw new Error('This institutional group has conflicting subscription tiers. Contact the Super Admin.');
          }
        }

        // Count after any initial group assignment. The current tenant
        // is included in this count.
        const groupCount = await tx.organization.count({
          where: {
            schoolGroup: targetGroup,
          },
        });

        if (groupCount >= maxAllowed) {
          throw new Error(
            `Tier limit reached: ${currentTier} allows up to ${maxAllowed} entities in this group.`
          );
        }

        const newOrganization = await tx.organization.create({
          data: {
            name,
            subdomain,
            schoolGroup: targetGroup,
            tier: currentTier,
            type: rawType,
            status: 'Active',
          },
        });

        const ownerUsername = (
          `${owner.username}_${subdomain}`
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '')
        ).slice(0, 30);

        // Exactly one account is created: the owner of this new tenant.
        await tx.tenantUser.create({
          data: {
            organizationId: newOrganization.id,
            userId: `USR-${subdomain.toUpperCase()}-001`,
            fullName: owner.fullName,
            username: ownerUsername || `admin_${subdomain}`.slice(0, 30),
            email: owner.email.toLowerCase(),
            role: 'admin',
            allowedTabs: JSON.stringify(PRESET_ROLE_TABS.admin),
            status: 'Active',
          },
        });

        await tx.systemLog.create({
          data: {
            organizationId: newOrganization.id,
            user: owner.fullName,
            action: 'PROVISION_SUB_ENTITY',
            details: `Created '${newOrganization.name}' (${newOrganization.subdomain}) in group '${targetGroup}', tier '${currentTier}'.`,
          },
        });
        return { organization: newOrganization, ownerName: owner.fullName };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      }
    );

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/provisions');
    revalidatePath('/dashboard/entity/portal');

    return {
      success: true,
      message: 'New entity workspace provisioned. The owner account has been created.',
      organizationId: result.organization.id,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    ) {
      throw new Error(
        'Another provisioning operation changed the group at the same time. Refresh and try again.'
      );
    }

    throw error;
  }
}

export async function logoutEntityAdminAction() {
  const cookieStore = await cookies();

  cookieStore.delete('clear_entity_session');
  cookieStore.delete('clear_entity_otp');
  // The Entity Admin cookie and NextAuth JWT are separate sessions. End both.
  await signOut({ redirect: false });
  redirect('/dashboard/entity/login');
}