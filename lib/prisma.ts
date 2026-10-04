import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient();
};

declare global {
  // Allow global `var` declarations
  // eslint-disable-next-line no-var
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

// Only cache the connection in development. In production, Next.js handles it differently.
if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}