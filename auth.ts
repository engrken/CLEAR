// /auth.ts (Root of your project)
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

// 1. CUSTOM ERROR CLASS: Forces NextAuth to display actual error messages instead of "Configuration"
class CustomAuthError extends CredentialsSignin {
  constructor(message: string) {
    super(message);
    this.code = message; 
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "OTP Verification",
      credentials: {
        email: { label: "Email", type: "email" },
        // Supports 'code' from the admin modal or 'otp' from legacy requests
        code: { label: "Verification Code", type: "text" }, 
      },
      async authorize(credentials) {
        const email = credentials?.email ? String(credentials.email).trim().toLowerCase() : null;
        const code = credentials?.code ? String(credentials.code).trim() : null;

        if (!email || !code) {
          throw new CustomAuthError("Email and verification code are required.");
        }

        // =======================================================
        // 2. SUPER ADMIN AUTHORIZATION (CLEAR System Architect)
        // =======================================================
        if (email === "kent.bsece@gmail.com") {
          const tokenRecord = await prisma.verificationToken.findUnique({
            where: { identifier: email },
          });

          if (!tokenRecord) {
            throw new CustomAuthError("No verification code requested.");
          }

          if (tokenRecord.token !== code) {
            throw new CustomAuthError("Invalid verification code.");
          }

          if (tokenRecord.expires < new Date()) {
            throw new CustomAuthError("Verification code has expired.");
          }

          // Clear OTP after successful use to prevent replay attacks
          await prisma.verificationToken.delete({
            where: { identifier: email },
          });

          return {
            id: "super-admin-01",
            name: "System Architect",
            email: email,
            role: "SuperAdmin",
          };
        }

        // =======================================================
        // 3. TENANT USER AUTHORIZATION (Department Officers)
        // =======================================================
        const user = await prisma.tenantUser.findFirst({
          where: { email },
        });

        if (!user || user.status !== 'Active') {
          throw new CustomAuthError("Email not found in authorized officers roster or account is inactive.");
        }

        if (!user.otpCode || user.otpCode.trim() !== code) {
          throw new CustomAuthError("Invalid verification code.");
        }

        if (user.otpExpires && new Date() > user.otpExpires) {
          throw new CustomAuthError("Verification code has expired.");
        }

        // Clear OTP after successful use using the unique record id
        await prisma.tenantUser.update({
          where: { id: user.id },
          data: { otpCode: null, otpExpires: null },
        });

        return {
          id: user.id,
          name: user.fullName,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  pages: {
    signIn: '/',
  },
  session: {
    strategy: 'jwt',
    maxAge: 6 * 60 * 60, // 6 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
});