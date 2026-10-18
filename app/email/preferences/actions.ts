"use server";
import { prisma } from "@/lib/prisma";
import { verifyEmailPreferenceLink } from "@/lib/transaction-email-preferences";
import { redirect } from "next/navigation";

export async function saveEmailLinkPreferences(formData: FormData) {
  const token = String(formData.get("token") || "");
  const recipient = verifyEmailPreferenceLink(token);
  if (!recipient) throw new Error("This preferences link has expired. Please use a recent email.");
  const organization = await prisma.organization.findUnique({
    where: { id: recipient.org }, select: { id: true },
  });
  if (!organization) throw new Error("Organization is unavailable.");
  await prisma.transactionEmailPreference.upsert({
    where: { organizationId_email: { organizationId: recipient.org, email: recipient.email } },
    create: {
      organizationId: recipient.org, email: recipient.email,
      receiveParticipantEmails: formData.get("participant") === "on",
      receiveOfficerCopies: formData.get("officer") === "on",
    },
    update: {
      receiveParticipantEmails: formData.get("participant") === "on",
      receiveOfficerCopies: formData.get("officer") === "on",
    },
  });
  redirect(`/email/preferences?token=${encodeURIComponent(token)}&saved=1`);
}
