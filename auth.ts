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
        const email = credentials?.email
          ? String(credentials.email)
              .trim()
              .toLowerCase()
          : null;

        const code = credentials?.code
          ? String(credentials.code).trim()
          : null;

        const department =
          credentials?.department
            ? String(credentials.department)
                .trim()
                .toLowerCase()
            : null;

        if (!email || !code || !department) {
          throw new CustomAuthError(
            "Email, verification code, and department are required."
          );
        }

        // =====================================================
        // FIND REQUESTED DEPARTMENT
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

        // =====================================================
        // SUPER ADMIN
        // =====================================================

        if (
          email === "kent.bsece@gmail.com"
        ) {
          const tokenRecord =
            await prisma.verificationToken.findUnique({
              where: {
                identifier: email,
              },
            });

          if (!tokenRecord) {
            throw new CustomAuthError(
              "No verification code requested."
            );
          }

          if (
            tokenRecord.expires < new Date()
          ) {
            await prisma.verificationToken.delete({
              where: {
                identifier: email,
              },
            });

            throw new CustomAuthError(
              "Verification code has expired."
            );
          }

          if (
            tokenRecord.token !== code
          ) {
            throw new CustomAuthError(
              "Invalid verification code."
            );
          }

          await prisma.verificationToken.delete({
            where: {
              identifier: email,
            },
          });

          return {
            id: "super-admin-01",
            name: "System Architect",
            email,
            role: "SuperAdmin",
            organizationId: null,
          };
        }

        // =====================================================
        // TENANT USER
        // =====================================================

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
            "This account is not registered or is inactive for this department."
          );
        }

        // =====================================================
        // VERIFY OTP
        // =====================================================

        if (
          !user.otpCode ||
          user.otpCode.trim() !== code
        ) {
          throw new CustomAuthError(
            "Invalid verification code."
          );
        }

        if (
          !user.otpExpires ||
          new Date() > user.otpExpires
        ) {
          await prisma.tenantUser.update({
            where: {
              id: user.id,
            },

            data: {
              otpCode: null,
              otpExpires: null,
            },
          });

          throw new CustomAuthError(
            "Verification code has expired."
          );
        }

        // =====================================================
        // CLEAR OTP
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

        // =====================================================
        // AUTHENTICATED USER
        // =====================================================

        return {
          id: user.id,
          name: user.fullName,
          email: user.email,
          role: user.role,
          organizationId:
            user.organizationId,
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
        token.role = user.role;
        token.organizationId =
          user.organizationId;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id =
          token.sub ?? "";

        session.user.role =
          token.role ?? "viewer";

        session.user.organizationId =
          token.organizationId ?? null;
      }

      return session;
    },
  },
});