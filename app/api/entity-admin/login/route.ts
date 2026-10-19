// /app/api/entity-admin/login/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { sendEmail } from '@/lib/mailer';
import {
  signEntityToken,
  type EntitySessionClaims,
} from '@/lib/entity-session';
import { isReservedGlobalAdminEmail, isGlobalSuperAdminEmail } from '@/lib/super-admin';
import {
  issueSuperAdminOtp,
  verifySuperAdminOtp,
} from '@/lib/super-admin-otp';

export const runtime = 'nodejs';

const OTP_TTL_MS = 5 * 60 * 1000;
const SEND_COOLDOWN_MS = 60 * 1000;
const SEND_WINDOW_MS = 60 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 5;
const MAX_GUESSES = 5;
const LOCKOUT_MS = 30 * 60 * 1000;

const GENERIC_MESSAGE =
  'If this email is authorized for the Entity Admin Portal, a verification code will be sent.';

const genericResponse = () =>
  NextResponse.json({
    success: true,
    message: GENERIC_MESSAGE,
  });

const normalizeEmail = (value: unknown) =>
  String(value ?? '').trim().toLowerCase();

const hashOtp = (
  identifier: string,
  tenantUserId: string,
  organizationId: string,
  code: string
) =>
  crypto
    .createHash('sha256')
    .update(`${identifier}:${tenantUserId}:${organizationId}:${code}`)
    .digest('hex');

function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a, 'utf8');
  const B = Buffer.from(b, 'utf8');

  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return entities[character];
  });
}

async function dispatchOtpEmail(
  toEmail: string,
  otpCode: string,
  orgName: string
): Promise<void> {
  await sendEmail({
    to: toEmail,
    subject: '[CLEAR System] Entity Admin Verification Code',
    text:
      'Your CLEAR System verification code is ' + otpCode + '. ' +
      'It expires in 5 minutes.',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0f172a;color:#f8fafc;border-radius:12px">
        <h2 style="color:#38bdf8">Entity Admin Portal Verification</h2>
        <p style="color:#cbd5e1">
          Your verification request is associated with
          <strong>${escapeHtml(orgName)}</strong>.
        </p>
        <div style="background:#1e293b;border:1px solid #38bdf8;padding:16px;border-radius:8px;text-align:center;font-size:28px;font-weight:bold;letter-spacing:6px;color:#38bdf8;margin:20px 0">
          ${otpCode}
        </div>
        <p style="color:#94a3b8;font-size:12px">
          This code expires in 5 minutes. Ignore this email if you did not request it.
        </p>
      </div>
    `,
  });
}

async function allowOtpSend(email: string): Promise<boolean> {
  const now = new Date();
  const key = `entity-admin-otp:send:${email}`;

  await prisma.authThrottle.upsert({
    where: { key },
    create: {
      key,
      failedCount: 0,
      lastSentAt: now,
      updatedAt: new Date(0),
    },
    update: {},
  });

  await prisma.authThrottle.updateMany({
    where: {
      key,
      lastSentAt: {
        lte: new Date(now.getTime() - SEND_WINDOW_MS),
      },
    },
    data: {
      failedCount: 0,
      lastSentAt: now,
    },
  });

  const admitted = await prisma.authThrottle.updateMany({
    where: {
      key,
      failedCount: { lt: MAX_SENDS_PER_WINDOW },
      updatedAt: {
        lte: new Date(now.getTime() - SEND_COOLDOWN_MS),
      },
    },
    data: {
      failedCount: { increment: 1 },
      updatedAt: now,
    },
  });

  return admitted.count === 1;
}

async function reserveOtpAttempt(email: string): Promise<boolean> {
  const now = new Date();
  const key = `entity-admin-otp:guess:${email}`;

  await prisma.authThrottle.updateMany({
    where: {
      key,
      lockedUntil: { lte: now },
    },
    data: {
      failedCount: 0,
      lockedUntil: null,
      updatedAt: now,
    },
  });

  await prisma.authThrottle.upsert({
    where: { key },
    create: {
      key,
      failedCount: 0,
      lockedUntil: null,
      updatedAt: now,
    },
    update: {},
  });

  const admitted = await prisma.authThrottle.updateMany({
    where: {
      key,
      failedCount: { lt: MAX_GUESSES },
      lockedUntil: null,
    },
    data: {
      failedCount: { increment: 1 },
      updatedAt: now,
    },
  });

  if (admitted.count === 1) return true;

  await prisma.authThrottle.updateMany({
    where: {
      key,
      failedCount: { gte: MAX_GUESSES },
      lockedUntil: null,
    },
    data: {
      lockedUntil: new Date(now.getTime() + LOCKOUT_MS),
      updatedAt: now,
    },
  });

  return false;
}

async function resetOtpAttempts(email: string) {
  await prisma.authThrottle.updateMany({
    where: { key: `entity-admin-otp:guess:${email}` },
    data: {
      failedCount: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    },
  });
}

async function lockOtpAttempts(email: string) {
  const now = new Date();

  await prisma.authThrottle.updateMany({
    where: {
      key: `entity-admin-otp:guess:${email}`,
      lockedUntil: null,
    },
    data: {
      lockedUntil: new Date(now.getTime() + LOCKOUT_MS),
      updatedAt: now,
    },
  });
}

async function createEntitySession(
  claims: Omit<EntitySessionClaims, 'iat' | 'exp'>
) {
  const now = Date.now();

  const token = signEntityToken({
    ...claims,
    iat: now,
    exp: now + 24 * 60 * 60 * 1000,
  });

  const cookieStore = await cookies();

  cookieStore.set('clear_entity_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60,
  });

  cookieStore.delete('clear_entity_otp');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const email = normalizeEmail(body?.email);
    const step = String(body?.step || 'request_otp');
    const submittedOtp = String(body?.otpCode || '').trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Please provide a valid email address.',
        },
        { status: 400 }
      );
    }

    // -------------------------------------------------------
    // REQUEST OTP
    // -------------------------------------------------------
    if (step === 'request_otp') {
      // The global Super Admin uses the existing protected OTP service,
      // not a duplicate TenantUser record.
      if (await isReservedGlobalAdminEmail(email)) {
        if (!(await isGlobalSuperAdminEmail(email))) return genericResponse();
        const result = await issueSuperAdminOtp(email);

        return NextResponse.json({
          success: true,
          message: result.message,
        });
      }

      const candidates = await prisma.tenantUser.findMany({
        where: {
          email: {
            equals: email,
            mode: 'insensitive',
          },
          status: 'Active',
        },
        include: {
          organization: true,
        },
      });

      const eligible = candidates.filter((user) => (
        ['admin', 'administrator'].includes(
          String(user.role).trim().toLowerCase()
        ) &&
        user.organization.status === 'Active'
      ));

      if (eligible.length === 0) {
        return genericResponse();
      }

      const groups = new Set(
        eligible.map((user) =>
          String(user.organization.schoolGroup || 'default-school')
            .trim()
            .toLowerCase()
        )
      );

      // An email shared across different groups cannot silently choose
      // an arbitrary tenant group.
      if (groups.size > 1) {
        return NextResponse.json(
          {
            success: false,
            message:
              'This email is associated with multiple institutional groups. ' +
              'Ask the Super Admin to resolve the account association before signing in.',
          },
          { status: 409 }
        );
      }

      // Choose a stable organization context instead of an arbitrary
      // findFirst() result. Child organizations retain this same group.
      eligible.sort((a, b) => {
        const byCreatedAt =
          a.organization.createdAt.getTime() -
          b.organization.createdAt.getTime();

        return byCreatedAt ||
          a.organizationId.localeCompare(b.organizationId);
      });

      const selected = eligible[0];

      // For non-existent or throttled accounts, use a generic response.
      if (!(await allowOtpSend(email))) {
        return genericResponse();
      }

      const code = crypto.randomInt(100000, 1000000).toString();
      const identifier = `entity-admin:${email}`;
      const storedHash = hashOtp(
        identifier,
        selected.id,
        selected.organizationId,
        code
      );

      const storedToken =
        `${selected.id}.${selected.organizationId}.${storedHash}`;

      await prisma.verificationToken.upsert({
        where: { identifier },
        create: {
          identifier,
          token: storedToken,
          expires: new Date(Date.now() + OTP_TTL_MS),
        },
        update: {
          token: storedToken,
          expires: new Date(Date.now() + OTP_TTL_MS),
        },
      });

      try {
        await dispatchOtpEmail(
          email,
          code,
          selected.organization.name
        );
      } catch (error) {
        console.error('Entity administrator OTP email failed:', error);

        await prisma.verificationToken.deleteMany({
          where: {
            identifier,
            token: storedToken,
          },
        });

        return NextResponse.json(
          {
            success: false,
            message: 'Unable to send the verification email. Please try again later.',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message:
          `A verification code has been sent to ${email}. ` +
          'It expires in 5 minutes.',
      });
    }

    // -------------------------------------------------------
    // VERIFY OTP
    // -------------------------------------------------------
    if (step !== 'verify_otp') {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid authentication step.',
        },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(submittedOtp)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Enter a valid 6-digit verification code.',
        },
        { status: 400 }
      );
    }

    // Super Admin verification does not depend on a TenantUser row.
    if (await isReservedGlobalAdminEmail(email)) {
      const result = await verifySuperAdminOtp(email, submittedOtp);

      if (!result.ok) {
        return NextResponse.json(
          { success: false, message: result.message },
          { status: 401 }
        );
      }

      await createEntitySession({
        purpose: 'clear-entity-session',
        email,
        role: 'SuperAdmin',
        isSuperAdmin: true,
        globalAdminId: result.identity.id,
        globalAdminVersion: result.identity.sessionVersion,
      });

      return NextResponse.json({
        success: true,
        message: 'Verification successful.',
      });
    }

    const identifier = `entity-admin:${email}`;
    const stored = await prisma.verificationToken.findUnique({
      where: { identifier },
    });

    if (!stored || stored.expires <= new Date()) {
      if (stored) {
        await prisma.verificationToken.deleteMany({
          where: { identifier },
        });
      }

      return NextResponse.json(
        {
          success: false,
          message: 'Invalid or expired verification code. Request a new code.',
        },
        { status: 401 }
      );
    }

    if (!(await reserveOtpAttempt(email))) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Too many verification attempts. Wait 30 minutes before trying again.',
        },
        { status: 429 }
      );
    }

    const parts = stored.token.split('.');

    if (parts.length !== 3) {
      await prisma.verificationToken.deleteMany({
        where: { identifier },
      });

      return NextResponse.json(
        {
          success: false,
          message: 'Invalid or expired verification code. Request a new code.',
        },
        { status: 401 }
      );
    }

    const [tenantUserId, organizationId, storedHash] = parts;

    const user = await prisma.tenantUser.findFirst({
      where: {
        id: tenantUserId,
        organizationId,
        email: {
          equals: email,
          mode: 'insensitive',
        },
        status: 'Active',
      },
      include: {
        organization: true,
      },
    });

    if (
      !user ||
      !['admin', 'administrator'].includes(
        String(user.role).trim().toLowerCase()
      ) ||
      user.organization.status !== 'Active'
    ) {
      await prisma.verificationToken.deleteMany({
        where: { identifier },
      });

      return NextResponse.json(
        {
          success: false,
          message: 'Invalid or expired verification code. Request a new code.',
        },
        { status: 401 }
      );
    }

    const expectedHash = hashOtp(
      identifier,
      tenantUserId,
      organizationId,
      submittedOtp
    );

    if (!safeEqual(storedHash, expectedHash)) {
      const attempt = await prisma.authThrottle.findUnique({
        where: {
          key: `entity-admin-otp:guess:${email}`,
        },
      });

      if ((attempt?.failedCount ?? 0) >= MAX_GUESSES) {
        await lockOtpAttempts(email);

        await prisma.verificationToken.deleteMany({
          where: { identifier },
        });

        return NextResponse.json(
          {
            success: false,
            message:
              'Too many verification attempts. Wait 30 minutes and request a new code.',
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          message: 'Invalid or expired verification code.',
        },
        { status: 401 }
      );
    }

    // Consume the OTP exactly once.
    const consumed = await prisma.verificationToken.deleteMany({
      where: {
        identifier,
        token: stored.token,
        expires: { gt: new Date() },
      },
    });

    if (consumed.count !== 1) {
      return NextResponse.json(
        {
          success: false,
          message: 'This verification code has already been used or expired.',
        },
        { status: 401 }
      );
    }

    await resetOtpAttempts(email);

    await createEntitySession({
      purpose: 'clear-entity-session',
      email,
      role: 'admin',
      isSuperAdmin: false,
      tenantUserId: user.id,
      organizationId: user.organizationId,
    });

    return NextResponse.json({
      success: true,
      message: 'OTP verified. Opening the Entity Admin Portal.',
    });
  } catch (error) {
    console.error('Entity Admin Authentication Error:', error);

    return NextResponse.json(
      {
        success: false,
        message:
          'Entity authentication could not be completed. Check the server configuration and logs.',
      },
      { status: 500 }
    );
  }
}