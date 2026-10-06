import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

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

        console.log("AUTH EMAIL:", email);
        console.log("AUTH DEPARTMENT:", department);
        console.log("AUTH CODE RECEIVED:", !!code);

        if (!email || !code) {
          throw new CustomAuthError(
            "Email and verification code are required."
          );
        }

        // =====================================================
        // SUPER ADMIN
        // =====================================================

        if (email === "kent.bsece@gmail.com") {
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

          if (tokenRecord.token !== code) {
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
            id: user.id,
            name: user.fullName,
            email: user.email,
            role: user.role,
            organizationId: null,
            department: null,
            allowedTabs: [],
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

        // =====================================================
        // FIND ORGANIZATION
        // =====================================================

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

        console.log(
          "AUTH ORGANIZATION:",
          organization.id,
          organization.subdomain
        );

        // =====================================================
        // FIND USER
        // =====================================================

        const user =
          await prisma.tenantUser.findFirst({
            where: {
              organizationId: organization.id,
              email,
              status: "Active",
            },
          });

        console.log("AUTH USER FOUND:", !!user);
        console.log("AUTH USER ID:", user?.id);
        console.log(
          "AUTH OTP EXISTS:",
          !!user?.otpCode
        );

        console.log(
          "AUTH OTP EXPIRED:",
          user?.otpExpires
            ? user.otpExpires < new Date()
            : false
        );

        if (!user) {
          throw new CustomAuthError(
            "This account is not authorized for this department."
          );
        }

        // =====================================================
        // CHECK OTP EXISTENCE
        // =====================================================

        if (!user.otpCode) {
          throw new CustomAuthError(
            "No department verification code requested."
          );
        }

        // =====================================================
        // CHECK OTP EXPIRATION
        // =====================================================

        if (
          !user.otpExpires ||
          user.otpExpires < new Date()
        ) {
          throw new CustomAuthError(
            "Verification code has expired."
          );
        }

        // =====================================================
        // CHECK OTP VALUE
        // =====================================================

        if (
          user.otpCode.trim() !== code.trim()
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

        console.log("AUTH CLEARING OTP...");

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

        // =====================================================
        // PARSE ALLOWED TABS
        // =====================================================

        let allowedTabs: string[] = [];

        try {
          if (user.allowedTabs) {
            const parsed =
              JSON.parse(user.allowedTabs);

            if (Array.isArray(parsed)) {
              allowedTabs = parsed;
            }
          }
        } catch {
          allowedTabs = [];
        }

        console.log(
          "AUTH ALLOWED TABS:",
          allowedTabs
        );

        // =====================================================
        // SUCCESS
        // =====================================================

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
        if (authenticatedUser.username) token.username = authenticatedUser.username; // ADDED
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
        if (token.username) sessionUser.username = token.username; // ADDED
        sessionUser.allowedTabs = token.allowedTabs || [];
      }
      return session;
    },
  },
});