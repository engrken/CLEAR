import { prisma } from './prisma';

const TENANT_MODELS = [
  'Student', 'Collection', 'Penalty', 'CashAdvance',
  'Audit', 'ExpenseItem', 'Collectible', 'CollectionSetup',
  'Fund', 'FundTransfer', 'OnlineRemittance', 'TenantUser'
];

export function withTenant(organizationId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (model && TENANT_MODELS.includes(model)) {
            if (['findMany', 'findFirst', 'count', 'aggregate', 'groupBy'].includes(operation)) {
              // Ensure args and args.where are safely initialized as objects
              const safeArgs = args || {};
              safeArgs.where = { ...(safeArgs.where || {}), organizationId };
              return query(safeArgs);
            }
          }
          
          return query(args);
        }
      }
    }
  });
}