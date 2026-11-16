import 'server-only';
import { prisma } from '@/lib/prisma';
import { aiDailyQuota } from '@/lib/ai/policy';

/**
 * Reserve a request before calling Gemini. Transactions for the same tenant/officer
 * acquire a transaction-scoped PostgreSQL advisory lock, so concurrent requests
 * cannot bypass the daily allowance. Counts attempts (including provider failures).
 * No migration or long-lived transaction is needed.
 */
export async function reserveAiRequest(input: {
  organizationId: string;
  officerEmail: string;
  tier: string;
}): Promise<boolean> {
  const limit = aiDailyQuota(input.tier);
  if (limit <= 0) return false;
  const key = `CLEAR_AI_QUOTA:${input.organizationId}:${input.officerEmail.toLowerCase()}`;
  return prisma.$transaction(async tx => {
    // Advisory lock is released on commit/rollback. Return an int column for Prisma.
    await tx.$queryRaw`SELECT 1::int AS acquired FROM pg_advisory_xact_lock(hashtextextended(${key}::text, 0))`;
    const used = await tx.systemLog.count({
      where: {
        organizationId: input.organizationId,
        action: 'AI_ASSISTANT_REQUEST',
        user: input.officerEmail.toLowerCase(),
        timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (used >= limit) return false;
    await tx.systemLog.create({
      data: {
        organizationId: input.organizationId,
        user: input.officerEmail.toLowerCase(),
        action: 'AI_ASSISTANT_REQUEST',
        details: 'Read-only AI request admitted. Prompt and response are not stored. Failed calls also count toward quota.',
      },
    });
    return true;
  }, { maxWait: 5000, timeout: 5000 });
}
