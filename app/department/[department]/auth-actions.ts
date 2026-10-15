// /app/department/[department]/auth-actions.ts
'use server';

import { prisma } from '@/lib/prisma';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { sendEmail } from '@/lib/mailer'; // 🚀 CENTRALIZED MAILER
import { isSuperAdminEmail } from '@/lib/permissions'; // 🚀 CENTRALIZED GUARD

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
  // SUPER ADMIN (F2 Fix)
  // =========================================================
  if (isSuperAdminEmail(cleanEmail)) {
    // Clear out any existing tokens for this identifier first to avoid composite key conflicts
    await prisma.verificationToken.deleteMany({
      where: { identifier: cleanEmail },
    });

    await prisma.verificationToken.create({
      data: {
        identifier: cleanEmail,
        token: hashedOtp, // 🚀 Store hashed token securely
        expires: otpExpires,
      },
    });

    try {
      await sendEmail({
        to: cleanEmail,
        subject: 'CLEAR System: System Admin Verification Code',
        html: `
          <div style="
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 0 auto;
            padding: 30px;
            background: #f8f9fa;
          ">
            <div style="
              background: #ffffff;
              border-radius: 12px;
              padding: 30px;
              border: 1px solid #dee2e6;
            ">
              <h2 style="
                margin-top: 0;
                color: #212529;
              ">
                CLEAR System
              </h2>
              <p>
                A System Admin login verification code has been requested.
              </p>
              <div style="
                text-align: center;
                margin: 30px 0;
              ">
                <div style="
                  display: inline-block;
                  padding: 15px 25px;
                  font-size: 32px;
                  font-weight: bold;
                  letter-spacing: 8px;
                  background: #f1f3f5;
                  border-radius: 10px;
                  color: #212529;
                ">
                  ${otp}
                </div>
              </div>
              <p>
                This verification code will expire in <strong>5 minutes</strong>.
              </p>
              <p style="
                color: #6c757d;
                font-size: 13px;
              ">
                If you did not request this code, you may safely ignore this email.
              </p>
            </div>
          </div>
        `,
        text: `Your CLEAR System verification code is: ${otp}`,
      });
    } catch (error) {
      await prisma.verificationToken.deleteMany({
        where: {
          identifier: cleanEmail,
        },
      });
      throw new Error(
        'Unable to send verification email. Please try again.'
      );
    }
    return {
      success: true,
      message:
        'A verification code has been sent to your registered email address.',
    };
  }

  // =========================================================
  // FIND ORGANIZATION
  // =========================================================
  const organization = await prisma.organization.findUnique({
    where: {
      subdomain: cleanDepartment,
    },
  });
  if (!organization) {
    throw new Error('Department not found.');
  }

  // =========================================================
  // FIND DEPARTMENT USER
  // =========================================================
  const user = await prisma.tenantUser.findFirst({
    where: {
      organizationId: organization.id,
      email: { equals: cleanEmail, mode: 'insensitive' },
      status: 'Active',
    },
  });
  if (!user) {
    throw new Error(
      'This account is not registered or is currently inactive.'
    );
  }

  // =========================================================
  // STORE DEPARTMENT USER OTP (Hashed for security - F14)
  // =========================================================
  await prisma.tenantUser.update({
    where: {
      id: user.id,
    },
    data: {
      otpCode: hashedOtp, // 🚀 Store SHA-256 hash instead of plaintext
      otpExpires,
    },
  });

  // =========================================================
  // SEND EMAIL (F46 Fix)
  // =========================================================
  try {
    await sendEmail({
      to: cleanEmail,
      subject: `CLEAR System: ${organization.name} Verification Code`,
      html: `
        <div style="
          font-family: Arial, sans-serif;
          max-width: 600px;
          margin: 0 auto;
          padding: 30px;
          background: #f8f9fa;
        ">
          <div style="
            background: #ffffff;
            border-radius: 12px;
            padding: 30px;
            border: 1px solid #dee2e6;
          ">
            <h2 style="
              margin-top: 0;
              color: #212529;
            ">
              CLEAR System
            </h2>
            <p>
              Hello <strong>${user.fullName}</strong>,
            </p>
            <p>
              Your verification code for
              <strong>${organization.name}</strong> is:
            </p>
            <div style="
              text-align: center;
              margin: 30px 0;
            ">
              <div style="
                display: inline-block;
                padding: 15px 25px;
                font-size: 32px;
                font-weight: bold;
                letter-spacing: 8px;
                background: #f1f3f5;
                border-radius: 10px;
                color: #212529;
              ">
                ${otp}
              </div>
            </div>
            <p>
              This verification code will expire in <strong>5 minutes</strong>.
            </p>
            <p style="
              color: #6c757d;
              font-size: 13px;
            ">
              If you did not request this code, you may safely ignore this email.
            </p>
          </div>
        </div>
      `,
      text: `Your CLEAR System verification code for ${organization.name} is: ${otp}`,
    });
  } catch (error) {
    await prisma.tenantUser.update({
      where: {
        id: user.id,
      },
      data: {
        otpCode: null,
        otpExpires: null,
      },
    });
    throw new Error(
      'Unable to send verification email. Please try again.'
    );
  }

  return {
    success: true,
    message:
      'A verification code has been sent to your registered email address.',
  };
}

// =========================================================
// VERIFY OTP (Fixed to query VerificationToken properly)
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
    // Find valid token by identifier (email)
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

    // Clean up used token
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
  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment },
  });
  if (!organization) {
    throw new Error('Department not found.');
  }

  const user = await prisma.tenantUser.findFirst({
    where: {
      organizationId: organization.id,
      email: { equals: cleanEmail, mode: 'insensitive' },
      status: 'Active',
    },
  });

  if (!user || !user.otpCode || !user.otpExpires || user.otpExpires < new Date()) {
    throw new Error('Verification code has expired or is invalid. Please request a new one.');
  }

  const storedHashBuf = Buffer.from(user.otpCode, 'utf8');
  const submittedHashBuf = Buffer.from(submittedHash, 'utf8');

  if (storedHashBuf.length !== submittedHashBuf.length || !crypto.timingSafeEqual(storedHashBuf, submittedHashBuf)) {
    throw new Error('Invalid verification code.');
  }

  // Clear OTP code after successful verification
  await prisma.tenantUser.update({
    where: { id: user.id },
    data: { otpCode: null, otpExpires: null },
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