// /lib/tenant.ts

import { prisma } from "./prisma";

const TENANT_MODELS = new Set([
  "Student",
  "Collection",
  "Penalty",
  "CashAdvance",
  "Audit",
  "Collectible",
  "CollectionSetup",
  "Fund",
  "FundTransfer",
  "OnlineRemittance",
  "CashierRemittance",
  "VoidTransaction",
  "FundRealignment",
  "Signatory",
  "TenantUser",
]);

export function withTenant(organizationId: string) {
  if (!organizationId?.trim()) {
    throw new Error("Invalid organization ID.");
  }

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_MODELS.has(model)) {
            return query(args);
          }

          const a = (args ?? {}) as any;

          // -------------------------------------------------------------
          // READ OPERATIONS (Safely handle findUnique vs findFirst)
          // -------------------------------------------------------------
          if (operation === "findUnique") {
            // Prisma findUnique requires matching unique constraints. 
            // Convert to findFirst to safely inject organizationId scoping.
            return (prisma as any)[model].findFirst({
              ...a,
              where: {
                ...(a.where ?? {}),
                organizationId,
              },
            });
          }

          if (
            [
              "findFirst",
              "findMany",
              "count",
              "aggregate",
              "groupBy",
            ].includes(operation)
          ) {
            return query({
              ...a,
              where: {
                ...(a.where ?? {}),
                organizationId,
              },
            });
          }

          // -------------------------------------------------------------
          // CREATE
          // -------------------------------------------------------------
          if (operation === "create") {
            return query({
              ...a,
              data: {
                ...(a.data ?? {}),
                organizationId,
              },
            });
          }

          // -------------------------------------------------------------
          // CREATE MANY
          // -------------------------------------------------------------
          if (operation === "createMany") {
            const data = Array.isArray(a.data)
              ? a.data.map((row: any) => ({
                  ...row,
                  organizationId,
                }))
              : {
                  ...(a.data ?? {}),
                  organizationId,
                };

            return query({
              ...a,
              data,
            });
          }

          // -------------------------------------------------------------
          // UPDATE / DELETE
          // organizationId is added to WHERE, NOT to update data.
          // -------------------------------------------------------------
          if (
            [
              "update",
              "updateMany",
              "delete",
              "deleteMany",
            ].includes(operation)
          ) {
            return query({
              ...a,
              where: {
                ...(a.where ?? {}),
                organizationId,
              },
            });
          }

          // -------------------------------------------------------------
          // UPSERT
          // -------------------------------------------------------------
          if (operation === "upsert") {
            return query({
              ...a,
              where: {
                ...(a.where ?? {}),
                organizationId,
              },
              create: {
                ...(a.create ?? {}),
                organizationId,
              },
            });
          }

          return query(args);
        },
      },
    },
  });
}