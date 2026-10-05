// lib/logger.ts
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
        user: user || "Anonymous / System",
        action,
        details: details || "",
      },
    });
  } catch (error) {
    // We log to the console instead of throwing an error to ensure 
    // the main action (like recording a payment) still succeeds 
    // even if the logging fails.
    console.error("System Audit Logging Failed:", error);
  }
}