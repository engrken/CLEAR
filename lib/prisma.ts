import 'server-only';
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

// Reuse connections during local hot reload; never instantiate per request.
export const prisma = globalThis.prismaGlobal ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
