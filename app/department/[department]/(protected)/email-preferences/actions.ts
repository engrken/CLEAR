"use server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { normalizePreferenceEmail } from "@/lib/transaction-email-preferences";
import { revalidatePath } from "next/cache";

export async function saveMyEmailPreferences(department: string, formData: FormData) {
  const dep = String(department).trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(dep)) throw new Error("Invalid organization.");
  const session = await auth();
  const email = normalizePreferenceEmail(session?.user?.email);
  const org = await prisma.organization.findUnique({where: {subdomain: dep}, select:{id:true}});
  if (!org || String((session?.user as { organizationId?: string } | undefined)?.organizationId || "") !== org.id)
    throw new Error("You cannot update email preferences for another organization.");
  const activeUser = await prisma.tenantUser.findFirst({
    where: { organizationId: org.id, email: {equals: email, mode: "insensitive"}, status: "Active" },
    select: {id: true},
  });
  if (!activeUser) throw new Error("An active officer account is required.");
  await prisma.transactionEmailPreference.upsert({
    where: { organizationId_email: {organizationId: org.id,email} },
    create: { organizationId:org.id, email,
      receiveParticipantEmails: formData.get("participant") === "on",
      receiveOfficerCopies: formData.get("officer") === "on" },
    update: { receiveParticipantEmails: formData.get("participant") === "on",
      receiveOfficerCopies: formData.get("officer") === "on" },
  });
  revalidatePath(`/department/${dep}/email-preferences`);
}
