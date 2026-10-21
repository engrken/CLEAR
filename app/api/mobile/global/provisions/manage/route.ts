import { revalidatePath } from 'next/cache';
import { handler, preflight, readJson, ApiFailure } from '@/lib/mobile/http';
import { requireGlobalMobileAdmin } from '@/lib/mobile/global-session';
import { requireAndroidProvisioningPreview, asProvisioningApiFailure } from '@/lib/mobile/provisioning-policy';
import { prisma } from '@/lib/prisma';
import {
  updateOrganizationStatusCore,
  updateOrganizationTierCore,
  updateOrganizationSchoolGroupCore,
  type SubscriptionTier,
  type OrganizationStatus,
} from '@/lib/provisioning/core';

/** Explicit, audited tenant lifecycle changes. No delete or financial mutation. */
export const POST = handler(async (req: Request) => {
  const { identity } = await requireGlobalMobileAdmin(req);
  requireAndroidProvisioningPreview();
  const body = await readJson<{
    organizationId: string;
    action: 'status' | 'tier' | 'group';
    value: string;
    confirmation: string;
  }>(req);
  const id = typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
  if (!id || id.length > 128) throw new ApiFailure(400, 'invalid', 'Invalid tenant ID.');
  if (!['status', 'tier', 'group'].includes(String(body.action))) {
    throw new ApiFailure(400, 'invalid', 'Unknown tenant management operation.');
  }
  const org = await prisma.organization.findUnique({
    where: { id },
    select: { id: true, subdomain: true, name: true },
  });
  if (!org) throw new ApiFailure(404, 'not_found', 'Tenant not found.');
  if (body.confirmation !== `MANAGE ${org.subdomain}`) {
    throw new ApiFailure(400, 'invalid', 'Confirm using MANAGE followed by the tenant subdomain.');
  }
  try {
    if (body.action === 'status') {
      await updateOrganizationStatusCore(identity.email, org.id, body.value as OrganizationStatus);
    } else if (body.action === 'tier') {
      await updateOrganizationTierCore(identity.email, org.id, body.value as SubscriptionTier);
    } else {
      await updateOrganizationSchoolGroupCore(identity.email, org.id, body.value as string);
    }
    revalidatePath('/dashboard/provisions');
    revalidatePath('/dashboard/entity/portal');
    return { success: true, organization: org.subdomain };
  } catch (e) { return asProvisioningApiFailure(e); }
});

export const OPTIONS = preflight;
