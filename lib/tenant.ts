import { prisma } from './prisma';

// 1. Define the models that are strictly scoped to an organization
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
            
            // 2. Auto-Inject Organization ID on Reads & Bulk Mutations
            // We omit findUnique/update/delete here because Prisma requires strict unique index fields for them.
            // In actions.ts, we will use findFirst, updateMany, and deleteMany instead.
            if (['findMany', 'findFirst', 'count', 'updateMany', 'deleteMany', 'aggregate'].includes(operation)) {
              args.where = { ...args.where, organizationId };
            }

            // 3. Auto-Inject Organization ID on Creates
            if (operation === 'create') {
              args.data = { ...args.data, organizationId };
            }
            if (operation === 'createMany' && args.data) {
              args.data = Array.isArray(args.data) 
                ? args.data.map((d: any) => ({ ...d, organizationId }))
                : { ...args.data, organizationId };
            }
          }
          
          return query(args);
        }
      }
    }
  });
}