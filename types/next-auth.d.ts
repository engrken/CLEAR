import "next-auth";
import "next-auth/jwt";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      organizationId: string | null;
      globalAdminId?: string | null;
      globalAdminVersion?: number | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: string;
    organizationId: string | null;
    globalAdminId?: string | null;
    globalAdminVersion?: number | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    organizationId?: string | null;
    globalAdminId?: string | null;
    globalAdminVersion?: number | null;
  }
}