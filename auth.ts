// /auth.ts

import NextAuth, { CredentialsSignin } from "next-auth";
import { redeemWebHandoff } from "@/lib/mobile/web-handoff-redeem";
import Credentials from "next-auth/providers/credentials";
import { isReservedGlobalAdminEmail } from "@/lib/super-admin";
import { verifySuperAdminOtp } from "@/lib/super-admin-otp";
import { verifyDepartmentOtp } from "@/lib/department-otp";
import { maintenanceForTenant } from "@/lib/maintenance/service";

class CustomAuthError extends CredentialsSignin {
  constructor(message: string) {
    super(message);
    this.code = message;
  }
}

const ALL_TABS = [
  'tab-overview', 'tab-students', 'tab-clearance', 'tab-payment',
  'tab-remittances', 'tab-penalties', 'tab-advances', 'tab-audit',
  'tab-collectibles', 'tab-reports', 'tab-void', 'tab-report',
  'tab-transfer', 'tab-users', 'tab-setup',
];

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    Credentials({
      id: 'mobile-handoff',
      name: 'Verified Mobile Handoff',
      credentials: { ticket: { label: 'One-time ticket', type: 'text' } },
      async authorize(credentials) {
        const ticket = typeof credentials?.ticket === 'string' ? credentials.ticket : '';
        if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) return null;
        return redeemWebHandoff(ticket);
      },
    }),
    Credentials({
      name: "OTP Verification",

      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Verification Code", type: "text" },
        department: { label: "Department", type: "text" },
      },

      async authorize(credentials) {
        const email = credentials?.email
          ? String(credentials.email).trim().toLowerCase()
          : "";
        const code = credentials?.code ? String(credentials.code).trim() : "";
        const department = credentials?.department
          ? decodeURIComponent(String(credentials.department)).trim().toLowerCase()
          : "";

        if (!email || !code) {
          throw new CustomAuthError("Email and verification code are required.");
        }
        if (!/^\d{6}$/.test(code)) {
          throw new CustomAuthError("Verification code must be 6 digits.");
        }

        // =====================================================
        // SUPER ADMIN (limits live in lib/super-admin-otp.ts)
        // =====================================================
        if (await isReservedGlobalAdminEmail(email)) {
          const result = await verifySuperAdminOtp(email, code);
          if (!result.ok) throw new CustomAuthError(result.message);

          return {
            id: result.identity.id,
            name: result.identity.fullName,
            email: result.identity.email,
            role: "SuperAdmin",
            globalAdminId: result.identity.id,
            globalAdminVersion: result.identity.sessionVersion,
            organizationId: null,
            department: null,
            username: "SuperAdmin",
            allowedTabs: [...ALL_TABS],
          };
        }

        // =====================================================
        // DEPARTMENT USER (limits live in lib/department-otp.ts)
        // =====================================================
        if (!department) {
          throw new CustomAuthError("Department is required.");
        }

        // NextAuth callback must remain reachable for Global Administrator
        // recovery during FULL. Tenant users, however, may authenticate only
        // during NORMAL or READ_ONLY; the shared callback is not a FULL bypass.
        const maintenance = await maintenanceForTenant(department);
        if (maintenance.mode === 'FULL') {
          throw new CustomAuthError('Tenant sign-in is unavailable during full maintenance.');
        }
        const result = await verifyDepartmentOtp(department, email, code);
        if (!result.ok) throw new CustomAuthError(result.message);

        return {
          id: result.user.id,
          name: result.user.fullName,
          email: result.user.email,
          role: result.user.role,
          organizationId: result.org.id,
          department: result.org.subdomain,
          username: result.user.username,
          allowedTabs: result.allowedTabs,
        };
      },
    }),
  ],

  pages: {
    signIn: "/",
  },

  session: {
    strategy: "jwt",
    maxAge: 6 * 60 * 60,
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authenticatedUser = user as any;
        token.role = authenticatedUser.role || null;
        token.organizationId = authenticatedUser.organizationId || null;
        token.department = authenticatedUser.department || null;
        token.username = authenticatedUser.username || null;
        token.allowedTabs = authenticatedUser.allowedTabs || [];
        token.globalAdminId = authenticatedUser.globalAdminId || null;
        token.globalAdminVersion = authenticatedUser.globalAdminVersion || null;
        token.handoffDestination = authenticatedUser.handoffDestination || null;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        const sessionUser = session.user as any;
        sessionUser.role = token.role || null;
        sessionUser.organizationId = token.organizationId || null;
        sessionUser.department = token.department || null;
        sessionUser.username = token.username || null;
        sessionUser.allowedTabs = token.allowedTabs || [];
        sessionUser.globalAdminId = token.globalAdminId || null;
        sessionUser.globalAdminVersion = token.globalAdminVersion || null;
        sessionUser.handoffDestination = token.handoffDestination || null;
        sessionUser.id = String(token.sub || sessionUser.id || '');
      }
      return session;
    },
  },
});
