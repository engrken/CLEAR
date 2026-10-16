// /auth.ts

import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isSuperAdminEmail, parseAllowedTabs } from "@/lib/permissions";

const MAX_OTP_ATTEMPTS = 5;

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

          if (tokenRecord.expires < new Date()) {
            throw new CustomAuthError(
              "Super Admin verification code has expired."
            );
          }

          const submittedHash = crypto.createHash('sha256').update(code).digest('hex');
          const storedHash = String(tokenRecord.token || '').trim();

          const storedBuf = Buffer.from(storedHash, 'utf8');
          const submittedBuf = Buffer.from(submittedHash, 'utf8');

          if (
            storedBuf.length !== submittedBuf.length ||
            !crypto.timingSafeEqual(storedBuf, submittedBuf)
          ) {
            throw new CustomAuthError(
              "Invalid Super Admin verification code."
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
          await prisma.organization.findFirst({
            where: {
              subdomain: { equals: department, mode: 'insensitive' },
            },
          });

        if (!organization) {
          throw new CustomAuthError(
            "Department not found."
          );
        }

        // Query user without restricting to "Active" so we can catch Blocked/Inactive statuses
        const user =
          await prisma.tenantUser.findFirst({
            where: {
              organizationId: organization.id,
              email: { equals: email, mode: 'insensitive' },
            },
          });

        if (!user) {
          throw new CustomAuthError(
            "This account is not authorized for this department."
          );
        }

        // Explicit Status & Lockout Checks
        if (user.status === 'Blocked') {
          throw new CustomAuthError(
            "ACCOUNT BLOCKED: Maximum failed login attempts (5) exceeded. Only an Admin or Super Admin can unblock your account."
          );
        }

        if (user.status !== 'Active') {
          throw new CustomAuthError(
            "This account is currently inactive. Please contact your administrator."
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

        const submittedUserHash = crypto.createHash('sha256').update(code).digest('hex');
        const storedUserHash = String(user.otpCode || '').trim();

        const storedUserBuf = Buffer.from(storedUserHash, 'utf8');
        const submittedUserBuf = Buffer.from(submittedUserHash, 'utf8');

        // =====================================================
        // HANDLE FAILED ATTEMPT & 5-STRIKE AUTO-BLOCK
        // =====================================================
        if (
          storedUserBuf.length !== submittedUserBuf.length ||
          !crypto.timingSafeEqual(storedUserBuf, submittedUserBuf)
        ) {
          console.log("AUTH OTP MISMATCH");
          const newAttempts = (user.otpAttempts || 0) + 1;

          if (newAttempts >= MAX_OTP_ATTEMPTS) {
            await prisma.tenantUser.update({
              where: { id: user.id },
              data: {
                status: 'Blocked',
                otpAttempts: newAttempts,
                otpCode: null,
                otpExpires: null,
              },
            });

            throw new CustomAuthError(
              "Maximum failed attempts (5/5) reached. Your account is now BLOCKED. Only an Admin or Super Admin can unblock your account."
            );
          } else {
            const remaining = MAX_OTP_ATTEMPTS - newAttempts;
            await prisma.tenantUser.update({
              where: { id: user.id },
              data: { otpAttempts: newAttempts },
            });

            throw new CustomAuthError(
              `Invalid verification code. You have ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before your account is blocked.`
            );
          }
        }

        console.log("AUTH OTP VALID.");

        // =====================================================
        // CONSUME OTP & RESET FAILED ATTEMPTS COUNTER
        // =====================================================

        await prisma.tenantUser.update({
          where: {
            id: user.id,
          },
          data: {
            otpCode: null,
            otpExpires: null,
            otpAttempts: 0, // Reset counter back to 0 on success
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