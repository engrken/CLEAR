import { prisma } from './prisma';

// Models that require multi-tenant isolation
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
          // Only intercept department-scoped models
          if (model && TENANT_MODELS.includes(model)) {
            
            // Safely inject organizationId into read and search queries
            if (['findMany', 'findFirst', 'count', 'aggregate', 'groupBy'].includes(operation)) {
              args = args || {};
              args.where = { ...args.where, organizationId };
            }
          }
          
          return query(args);
        }
      }
    }
  });
}