// /auth.ts

import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isSuperAdminEmail, parseAllowedTabs } from "@/lib/permissions";

class CustomAuthError extends CredentialsSignin {
  constructor(message: string) {
    super(message);
    this.code = message;
  }
}

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
        email: {
          label: "Email",
          type: "email",
        },

        code: {
          label: "Verification Code",
          type: "text",
        },

        department: {
          label: "Department",
          type: "text",
        },
      },

      async authorize(credentials) {
        console.log("========== AUTH START ==========");

        const email = credentials?.email
          ? String(credentials.email)
              .trim()
              .toLowerCase()
          : undefined;

        const code = credentials?.code
          ? String(credentials.code).trim()
          : undefined;

        const department = credentials?.department
          ? decodeURIComponent(
              String(credentials.department)
            )
              .trim()
              .toLowerCase()
          : undefined;

        if (!email || !code) {
          throw new CustomAuthError(
            "Email and verification code are required."
          );
        }

        // =====================================================
        // SUPER ADMIN
        // =====================================================

        if (isSuperAdminEmail(email)) {
          console.log("AUTH MODE: SUPER ADMIN");

          const tokenRecord =
            await prisma.verificationToken.findUnique({
              where: {
                identifier: email,
              },
            });

          if (!tokenRecord) {
            throw new CustomAuthError(
              "No Super Admin verification code requested."
            );
          }

          // 🚀 FIX: Compare plaintext stored token securely using timingSafeEqual
          const storedCode = String(tokenRecord.token || '').trim();
          const submittedCode = String(code || '').trim();

          const storedBuf = Buffer.from(storedCode, 'utf8');
          const submittedBuf = Buffer.from(submittedCode, 'utf8');

          if (
            storedBuf.length !== submittedBuf.length ||
            !crypto.timingSafeEqual(storedBuf, submittedBuf)
          ) {
            throw new CustomAuthError(
              "Invalid Super Admin verification code."
            );
          }

          if (tokenRecord.expires < new Date()) {
            throw new CustomAuthError(
              "Super Admin verification code has expired."
            );
          }

          await prisma.verificationToken.delete({
            where: {
              identifier: email,
            },
          });

          console.log("SUPER ADMIN AUTH SUCCESS");

          return {
            id: "SuperAdmin",
            name: "Kenneth Mark Bulquerin",
            email,
            role: "SuperAdmin",
            organizationId: null,
            department: null,
            username: "SuperAdmin",
            allowedTabs: [
              'tab-overview', 'tab-students', 'tab-clearance', 'tab-payment', 
              'tab-remittances', 'tab-penalties', 'tab-advances', 'tab-audit', 
              'tab-collectibles', 'tab-reports', 'tab-void', 'tab-report', 
              'tab-transfer', 'tab-users', 'tab-setup'
            ],
          };
        }

        // =====================================================
        // NORMAL DEPARTMENT USER
        // =====================================================

        console.log("AUTH MODE: DEPARTMENT USER");

        if (!department) {
          throw new CustomAuthError(
            "Department is required."
          );
        }

        const organization =
          await prisma.organization.findUnique({
            where: {
              subdomain: department,
            },
          });

        if (!organization) {
          throw new CustomAuthError(
            "Department not found."
          );
        }

        const user =
          await prisma.tenantUser.findFirst({
            where: {
              organizationId: organization.id,
              email,
              status: "Active",
            },
          });

        if (!user) {
          throw new CustomAuthError(
            "This account is not authorized for this department."
          );
        }

        if (!user.otpCode) {
          throw new CustomAuthError(
            "No department verification code requested."
          );
        }

        if (
          !user.otpExpires ||
          user.otpExpires < new Date()
        ) {
          throw new CustomAuthError(
            "Verification code has expired."
          );
        }

        // 🚀 FIX: Compare user plaintext otpCode securely using timingSafeEqual
        const storedUserCode = String(user.otpCode || '').trim();
        const submittedUserCode = String(code || '').trim();

        const storedUserBuf = Buffer.from(storedUserCode, 'utf8');
        const submittedUserBuf = Buffer.from(submittedUserCode, 'utf8');

        if (
          storedUserBuf.length !== submittedUserBuf.length ||
          !crypto.timingSafeEqual(storedUserBuf, submittedUserBuf)
        ) {
          console.log("AUTH OTP MISMATCH");
          throw new CustomAuthError(
            "Invalid verification code."
          );
        }

        console.log("AUTH OTP VALID.");

        // =====================================================
        // CONSUME OTP
        // =====================================================

        await prisma.tenantUser.update({
          where: {
            id: user.id,
          },
          data: {
            otpCode: null,
            otpExpires: null,
          },
        });

        console.log("AUTH OTP CLEARED.");

        const allowedTabs = parseAllowedTabs(user.allowedTabs);

        console.log(
          "========== AUTH SUCCESS =========="
        );

        return {
          id: user.id,
          name: user.fullName,
          email: user.email,
          role: user.role,
          organizationId: organization.id,
          department: organization.subdomain,
          username: user.username,
          allowedTabs,
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