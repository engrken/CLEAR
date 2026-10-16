// /app/department/[department]/auth-actions.ts
'use server';

import { prisma } from '@/lib/prisma';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { sendEmail } from '@/lib/mailer';
import { isSuperAdminEmail } from '@/lib/permissions';
import { auth } from '@/auth';

const MAX_OTP_ATTEMPTS = 5;
const MAX_OTP_REQUESTS_PER_DAY = 10;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 Hours

export async function requestOtp(
  department: string,
  email: string
) {
  const cleanDepartment = decodeURIComponent(department)
    .trim()
    .toLowerCase();
  const cleanEmail = String(email || '').trim().toLowerCase();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please provide a valid email address.');
  }

  // =========================================================
  // GENERATE OTP
  // =========================================================
  const otp = crypto.randomInt(100000, 1000000).toString();
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
  const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

  // =========================================================
  // SUPER ADMIN
  // =========================================================
  if (isSuperAdminEmail(cleanEmail)) {
    await prisma.verificationToken.deleteMany({
      where: { identifier: cleanEmail },
    });

    await prisma.verificationToken.create({
      data: {
        identifier: cleanEmail,
        token: hashedOtp,
        expires: otpExpires,
      },
    });

    try {
      await sendEmail({
        to: cleanEmail,
        subject: 'CLEAR System: System Admin Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background: #f8f9fa;">
            <div style="background: #ffffff; border-radius: 12px; padding: 30px; border: 1px solid #dee2e6;">
              <h2 style="margin-top: 0; color: #212529;">CLEAR System</h2>
              <p>A System Admin login verification code has been requested.</p>
              <div style="text-align: center; margin: 30px 0;">
                <div style="display: inline-block; padding: 15px 25px; font-size: 32px; font-weight: bold; letter-spacing: 8px; background: #f1f3f5; border-radius: 10px; color: #212529;">
                  ${otp}
                </div>
              </div>
              <p>This verification code will expire in <strong>5 minutes</strong>.</p>
            </div>
          </div>
        `,
        text: `Your CLEAR System verification code is: ${otp}`,
      });
    } catch (error) {
      await prisma.verificationToken.deleteMany({
        where: { identifier: cleanEmail },
      });
      throw new Error('Unable to send verification email. Please try again.');
    }
    return {
      success: true,
      message: 'A verification code has been sent to your registered email address.',
    };
  }

  // =========================================================
  // FIND ORGANIZATION
  // =========================================================
  const organization = await prisma.organization.findFirst({
    where: {
      subdomain: { equals: cleanDepartment, mode: 'insensitive' },
    },
  });
  if (!organization) {
    throw new Error('Department not found.');
  }

  // =========================================================
  // FIND DEPARTMENT USER & CHECK STATUS / RATE LIMIT
  // =========================================================
  const user = await prisma.tenantUser.findFirst({
    where: {
      organizationId: organization.id,
      email: { equals: cleanEmail, mode: 'insensitive' },
    },
  });

  if (!user) {
    throw new Error('This account is not registered under this department.');
  }

  if (user.status === 'Blocked') {
    throw new Error(
      'ACCOUNT BLOCKED: Maximum failed login attempts (5) exceeded. Only an Admin or Super Admin can unblock your account.'
    );
  }

  if (user.status !== 'Active') {
    throw new Error('This account is currently inactive. Please contact your administrator.');
  }

  // =========================================================
  // 🚀 24-HOUR RATE LIMIT CHECK (Max 10 Requests)
  // =========================================================
  const now = new Date();
  let requestCount = user.otpRequestCount || 0;
  let windowStart = user.otpLastRequestedAt ? new Date(user.otpLastRequestedAt) : null;

  if (!windowStart || now.getTime() - windowStart.getTime() > RATE_LIMIT_WINDOW_MS) {
    // Reset window if 24 hours have passed since the first request
    requestCount = 0;
    windowStart = now;
  }

  if (requestCount >= MAX_OTP_REQUESTS_PER_DAY) {
    throw new Error(
      'Daily OTP request limit (10 requests per 24 hours) has been reached. Please try again later tomorrow.'
    );
  }

  // =========================================================
  // STORE DEPARTMENT USER OTP & INCREMENT RATE LIMIT COUNTER
  // =========================================================
  await prisma.tenantUser.update({
    where: { id: user.id },
    data: {
      otpCode: hashedOtp,
      otpExpires,
      otpRequestCount: requestCount + 1,
      otpLastRequestedAt: windowStart,
    },
  });

  // =========================================================
  // SEND EMAIL
  // =========================================================
  try {
    await sendEmail({
      to: cleanEmail,
      subject: `CLEAR System: ${organization.name} Verification Code`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background: #f8f9fa;">
          <div style="background: #ffffff; border-radius: 12px; padding: 30px; border: 1px solid #dee2e6;">
            <h2 style="margin-top: 0; color: #212529;">CLEAR System</h2>
            <p>Hello <strong>${user.fullName}</strong>,</p>
            <p>Your verification code for <strong>${organization.name}</strong> is:</p>
            <div style="text-align: center; margin: 30px 0;">
              <div style="display: inline-block; padding: 15px 25px; font-size: 32px; font-weight: bold; letter-spacing: 8px; background: #f1f3f5; border-radius: 10px; color: #212529;">
                ${otp}
              </div>
            </div>
            <p>This verification code will expire in <strong>5 minutes</strong>.</p>
          </div>
        </div>
      `,
      text: `Your CLEAR System verification code for ${organization.name} is: ${otp}`,
    });
  } catch (error) {
    await prisma.tenantUser.update({
      where: { id: user.id },
      data: { otpCode: null, otpExpires: null },
    });
    throw new Error('Unable to send verification email. Please try again.');
  }

  return {
    success: true,
    message: 'A verification code has been sent to your registered email address.',
  };
}

// =========================================================
// VERIFY OTP (With 5-Attempt Lockout Enforcement)
// =========================================================
export async function verifyOtp(
  department: string,
  email: string,
  submittedOtp: string
) {
  const cleanDepartment = decodeURIComponent(department).trim().toLowerCase();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanOtp = String(submittedOtp || '').trim();

  if (!/^\d{6}$/.test(cleanOtp)) {
    throw new Error('Verification code must be exactly 6 digits.');
  }

  const submittedHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');
  const cookieStore = await cookies();

  // Handle Super Admin Verification
  if (isSuperAdminEmail(cleanEmail)) {
    const tokenRecord = await prisma.verificationToken.findFirst({
      where: { identifier: cleanEmail },
      orderBy: { expires: 'desc' },
    });

    if (!tokenRecord || !tokenRecord.token || tokenRecord.expires < new Date()) {
      throw new Error('Verification code has expired or is invalid. Please request a new one.');
    }

    const storedHashBuf = Buffer.from(tokenRecord.token, 'utf8');
    const submittedHashBuf = Buffer.from(submittedHash, 'utf8');

    if (storedHashBuf.length !== submittedHashBuf.length || !crypto.timingSafeEqual(storedHashBuf, submittedHashBuf)) {
      throw new Error('Invalid verification code.');
    }

    await prisma.verificationToken.deleteMany({
      where: { identifier: cleanEmail },
    });

    cookieStore.set('fcu_session', `superadmin:${cleanEmail}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 86400,
    });

    return {
      success: true,
      user: {
        id: 'superadmin',
        fullName: 'Super Administrator',
        email: cleanEmail,
        role: 'SuperAdmin',
        allowedTabs: ['*'],
      },
    };
  }

  // Handle Department Tenant User Verification
  const organization = await prisma.organization.findFirst({
    where: { subdomain: { equals: cleanDepartment, mode: 'insensitive' } },
  });
  if (!organization) {
    throw new Error('Department not found.');
  }

  const user = await prisma.tenantUser.findFirst({
    where: {
      organizationId: organization.id,
      email: { equals: cleanEmail, mode: 'insensitive' },
    },
  });

  if (!user) {
    throw new Error('This account is not registered under this department.');
  }

  if (user.status === 'Blocked') {
    throw new Error(
      'ACCOUNT BLOCKED: Maximum failed login attempts (5) exceeded. Only an Admin or Super Admin can unblock your account.'
    );
  }

  if (user.status !== 'Active') {
    throw new Error('This account is currently inactive. Please contact your administrator.');
  }

  if (!user.otpCode || !user.otpExpires || user.otpExpires < new Date()) {
    throw new Error('Verification code has expired or is invalid. Please request a new one.');
  }

  const storedHashBuf = Buffer.from(user.otpCode, 'utf8');
  const submittedHashBuf = Buffer.from(submittedHash, 'utf8');

  // Check OTP Match & Track Failed Attempts
  if (storedHashBuf.length !== submittedHashBuf.length || !crypto.timingSafeEqual(storedHashBuf, submittedHashBuf)) {
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
      throw new Error(
        'Maximum failed attempts (5/5) reached. Your account is now BLOCKED. Only an Admin or Super Admin can unblock your account.'
      );
    } else {
      const remaining = MAX_OTP_ATTEMPTS - newAttempts;
      await prisma.tenantUser.update({
        where: { id: user.id },
        data: { otpAttempts: newAttempts },
      });
      throw new Error(
        `Invalid verification code. You have ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before your account is blocked.`
      );
    }
  }

  // Clear OTP code and reset attempt counter after successful verification
  await prisma.tenantUser.update({
    where: { id: user.id },
    data: {
      otpCode: null,
      otpExpires: null,
      otpAttempts: 0,
    },
  });

  cookieStore.set('fcu_session', user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 86400,
  });

  let parsedTabs: string[] = [];
  try {
    parsedTabs = typeof user.allowedTabs === 'string' ? JSON.parse(user.allowedTabs) : (user.allowedTabs || []);
  } catch {
    parsedTabs = [];
  }

  return {
    success: true,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      allowedTabs: parsedTabs,
    },
  };
}

// =========================================================
// ADMIN / SUPER ADMIN: UPDATE ACCOUNT STATUS & UNBLOCK
// =========================================================
export async function updateUserAccountStatus(
  targetUserId: string,
  newStatus: 'Active' | 'Inactive' | 'Blocked'
) {
  const session = await auth();
  const callerUser = session?.user as any;

  if (!callerUser || (callerUser.role !== 'Admin' && callerUser.role !== 'SuperAdmin')) {
    throw new Error('Unauthorized: Only an Admin or Super Admin can change account status or unblock users.');
  }

  const targetUser = await prisma.tenantUser.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    throw new Error('User not found.');
  }

  // Ensure Department Admins can only manage users within their own organization
  if (callerUser.role !== 'SuperAdmin' && targetUser.organizationId !== callerUser.organizationId) {
    throw new Error('Unauthorized: You can only manage users within your own department.');
  }

  await prisma.tenantUser.update({
    where: { id: targetUserId },
    data: {
      status: newStatus,
      // When unblocking/activating, reset failed attempts and clear stale OTPs
      ...(newStatus === 'Active'
        ? { otpAttempts: 0, otpCode: null, otpExpires: null }
        : {}),
    },
  });

  return {
    success: true,
    message: `Account status for ${targetUser.fullName} updated to ${newStatus}.`,
  };
}