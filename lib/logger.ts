import { prisma } from '@/lib/prisma';

export async function logSystemAction(
  organizationId: string,
  user: string,
  action: string,
  details?: string
) {
  try {
    await prisma.systemLog.create({
      data: {
        organizationId,
        user: user || "Anonymous",
        action,
        details: details || "",
      },
    });
  } catch (error) {
    console.error("Audit log failure:", error);
  }
}