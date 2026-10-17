// /auth.ts

import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { verifySuperAdminOtp } from "@/lib/super-admin-otp";
import { verifyDepartmentOtp } from "@/lib/department-otp";

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
        if (isSuperAdminEmail(email)) {
          const result = await verifySuperAdminOtp(email, code);
          if (!result.ok) throw new CustomAuthError(result.message);

          return {
            id: "SuperAdmin",
            name: "Kenneth Mark Bulquerin",
            email,
            role: "SuperAdmin",
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
        if (authenticatedUser.role) token.role = authenticatedUser.role;
        if (authenticatedUser.organizationId) token.organizationId = authenticatedUser.organizationId;
        if (authenticatedUser.department) token.department = authenticatedUser.department;
        if (authenticatedUser.username) token.username = authenticatedUser.username;
        token.allowedTabs = authenticatedUser.allowedTabs || [];
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        const sessionUser = session.user as any;
        if (token.role) sessionUser.role = token.role;
        if (token.organizationId) sessionUser.organizationId = token.organizationId;
        if (token.department) sessionUser.department = token.department;
        if (token.username) sessionUser.username = token.username;
        sessionUser.allowedTabs = token.allowedTabs || [];
      }
      return session;
    },
  },
});
