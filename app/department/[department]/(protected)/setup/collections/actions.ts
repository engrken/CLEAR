"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireTabAccess } from "../../actions";

async function getOrgId(department: string) {
  const org = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase().trim() },
  });
  if (!org) throw new Error("Department organization context not found.");
  return org.id;
}

export async function saveCollectionSetupItem(
  department: string,
  payload: {
    category: string;
    name: string;
    amount: number;
    targetFund: string;
    isPackage: boolean;
    ay: string;
    term: string;
  }
) {
  await requireTabAccess("tab-setup");

  const orgId = await getOrgId(department);
  const cleanCategory = payload.category.trim();
  const cleanName = payload.name.trim();

  const existing = await prisma.collectionSetup.findFirst({
    where: {
      organizationId: orgId,
      academicYear: payload.ay,
      term: payload.term,
      name: cleanName,
    },
  });

  if (existing) {
    await prisma.collectionSetup.update({
      where: { id: existing.id },
      data: {
        category: cleanCategory,
        amount: Number(payload.amount) || 0,
        targetFund: payload.targetFund,
        isPackage: Boolean(payload.isPackage),
      },
    });
  } else {
    await prisma.collectionSetup.create({
      data: {
        organizationId: orgId,
        academicYear: payload.ay,
        term: payload.term,
        category: cleanCategory,
        name: cleanName,
        amount: Number(payload.amount) || 0,
        targetFund: payload.targetFund,
        isPackage: Boolean(payload.isPackage),
      },
    });
  }

  revalidatePath(`/department/${department}/setup/collections`);
  revalidatePath(`/department/${department}/collections`);
  revalidatePath(`/department/${department}/reports`);
  revalidatePath(`/department/${department}/clearance`);
  revalidatePath(`/department/${department}`);

  return { success: true, message: `Configured '${cleanName}' successfully.` };
}

export async function deleteCollectionSetupItem(department: string, setupId: string) {
  await requireTabAccess("tab-setup");

  const orgId = await getOrgId(department);

  await prisma.collectionSetup.delete({
    where: {
      id: setupId,
      organizationId: orgId,
    },
  });

  revalidatePath(`/department/${department}/setup/collections`);
  revalidatePath(`/department/${department}/collections`);
  revalidatePath(`/department/${department}/reports`);
  revalidatePath(`/department/${department}/clearance`);
  revalidatePath(`/department/${department}`);

  return { success: true, message: "Configuration item removed successfully." };
}
