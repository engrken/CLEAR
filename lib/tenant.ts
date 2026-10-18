import 'server-only';
import { prisma } from './prisma';

/**
 * Convenience query-level tenant scoping. This is NOT a substitute for
 * requireTabAccess or PostgreSQL row-level security. Raw SQL and nested
 * relation writes are outside this extension's guarantees.
 */
const TENANT_MODELS = new Set([
  'Student', 'Enrollment', 'Collection', 'Penalty', 'CashAdvance', 'Audit',
  'ExpenseItem', 'Collectible', 'CollectionSetup', 'Fund', 'FundTransfer',
  'OnlineRemittance', 'CashierRemittance', 'VoidTransaction', 'FundRealignment',
  'Signatory', 'TenantUser', 'SystemLog', 'MobileSession',
]);

function scopedWhere(original: unknown, organizationId: string) {
  const source = original && typeof original === 'object' ? original as Record<string, unknown> : {};
  const existingAnd = source.AND;
  const andParts = Array.isArray(existingAnd) ? existingAnd : existingAnd ? [existingAnd] : [];
  return { ...source, AND: [...andParts, { organizationId }] };
}

function scopedData(data: any, organizationId: string) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid tenant write payload.');
  }
  if (data.organizationId !== undefined && data.organizationId !== organizationId) {
    throw new Error('Cross-organization write rejected.');
  }
  return { ...data, organizationId };
}

export function withTenant(organizationId: string) {
  const id = String(organizationId || '').trim();
  if (!id) throw new Error('Invalid organization ID.');
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_MODELS.has(model)) return query(args);
          const input = (args ?? {}) as any;
          switch (operation) {
            case 'findUnique':
            case 'findUniqueOrThrow':
            case 'findFirst':
            case 'findFirstOrThrow':
            case 'findMany':
            case 'count':
            case 'aggregate':
            case 'groupBy':
            case 'delete':
            case 'deleteMany':
              return query({ ...input, where: scopedWhere(input.where, id) });
            case 'update':
            case 'updateMany':
              return query({ ...input, where: scopedWhere(input.where, id),
                data: { ...input.data, organizationId: id } });
            case 'create':
              return query({ ...input, data: scopedData(input.data, id) });
            case 'createMany':
            case 'createManyAndReturn':
              return query({
                ...input,
                data: Array.isArray(input.data)
                  ? input.data.map((row: any) => scopedData(row, id))
                  : scopedData(input.data, id),
              });
            case 'upsert':
              return query({
                ...input,
                where: scopedWhere(input.where, id),
                create: scopedData(input.create, id),
                update: { ...input.update, organizationId: id },
              });
            default:
              // Fail closed rather than silently execute an unscoped model operation.
              throw new Error(`Unsupported tenant-scoped operation: ${String(operation)}.`);
          }
        },
      },
    },
  });
}
