// /app/department/[department]/(protected)/collections/actions.ts

"use server";

import { requireDepartmentAccess } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';
import { recordPaymentFor, type RecordPaymentInput } from '@/lib/collections';

// The payment rules live in lib/collections.ts (shared with the mobile API);
// this action adds the web session guard and cache revalidation.

// =========================================================================
// PAYMENT ACTIONS
// =========================================================================

export async function recordPayment(department: string, data: RecordPaymentInput) {
  const { user, org } = await requireDepartmentAccess("tab-payment", department);
  const officerName = user.fullName || user.email || "System Administrator";

  await recordPaymentFor(org, officerName, data);

  revalidatePath(`/department/${org.subdomain}/collections`);
  revalidatePath(`/department/${org.subdomain}/penalties`);
  revalidatePath(`/department/${org.subdomain}/clearance`);
  revalidatePath(`/department/${org.subdomain}`);
}
