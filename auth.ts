// /auth.ts

import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isSuperAdminEmail, parseAllowedTabs } from "@/lib/permissions";
import {
  assertNotLocked,
  clearOtpFailures,
  otpThrottleKey,
  recordOtpFailure,
} from "@/lib/auth-throttle";
import { OtpError, verifyDepartmentOtp } from "@/lib/otp";

class CustomAuthError extends CredentialsSignin {
  constructor(message: string) {
    super(message);
    this.code = message;
  }
}

// Lockout check that surfaces its message to the login form (F7)
async function assertIdentityNotLocked(key: string) {
  try {
    await assertNotLocked(key);
  } catch (err) {
    throw new CustomAuthError((err as Error).message);
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
          const throttleKey = otpThrottleKey("superadmin", email);
          await assertIdentityNotLocked(throttleKey);

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
            if (await recordOtpFailure(throttleKey)) {
              await prisma.verificationToken.deleteMany({ where: { identifier: email } });
              throw new CustomAuthError(
                "Too many failed attempts. Request a new code in 15 minutes."
              );
            }
            throw new CustomAuthError(
              "Invalid Super Admin verification code."
            );
          }

          await prisma.verificationToken.delete({
            where: {
              identifier: email,
            },
          });

          await clearOtpFailures(throttleKey);

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


        if (!department) {
          throw new CustomAuthError(
            "Department is required."
          );
        }

        // 🚀 Synchronized: Case-insensitive organization lookup
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

        // Shared with the mobile API (lib/otp.ts): lockout, expiry,
        // timing-safe hash check, single use.
        let user;
        try {
          user = await verifyDepartmentOtp(organization, email, code);
        } catch (err) {
          if (err instanceof OtpError) throw new CustomAuthError(err.message);
          throw err;
        }

        const allowedTabs = parseAllowedTabs(user.allowedTabs);


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