// /app/department/[department]/auth-actions.ts
'use server';

import { prisma } from '@/lib/prisma';
import crypto from 'node:crypto';
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
    // The VerificationToken model uses identifier as its primary key, so use the email as identifier.
    await prisma.verificationToken.upsert({
      where: {
        identifier: cleanEmail,
      },
      update: {
        token: hashedOtp, // 🚀 Fixed F14: Store hashed token
        expires: otpExpires,
      },
      create: {
        identifier: cleanEmail,
        token: hashedOtp, // 🚀 Fixed F14: Store hashed token
        expires: otpExpires,
      },
    });

    try {
      // Dispatch via centralized mailer (F46 Fix)
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
      // Clear OTP if email failed.
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
      otpCode: hashedOtp, // 🚀 Fixed F14: Store SHA-256 hash instead of plaintext
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
    // Clear OTP if email failed.
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