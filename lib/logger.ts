import 'server-only';
import { prisma } from '@/lib/prisma';

/** For security/financial actions which must fail if the audit trail cannot be saved. */
export async function logSystemActionStrict(
  organizationId: string, user: string, action: string, details = '',
) {
  if (!organizationId || !action.trim()) throw new Error('Audit log organization and action are required.');
  await prisma.systemLog.create({
    data: { organizationId, user: user || 'System', action: action.trim(), details },
  });
}

/** Backward-compatible non-blocking logger for non-financial events. */
export async function logSystemAction(
  organizationId: string, user: string, action: string, details = '',
) {
  try {
    await logSystemActionStrict(organizationId, user, action, details);
  } catch (error) {
    console.error('System audit logging failed:', error);
  }
}
