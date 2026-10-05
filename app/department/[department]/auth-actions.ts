'use server';

import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

export async function requestOtp(
  department: string,
  email: string
) {
  const cleanDepartment = decodeURIComponent(department)
    .trim()
    .toLowerCase();

  const cleanEmail = email.trim().toLowerCase();

  // ---------------------------------------------------------
  // 1. Find the department
  // ---------------------------------------------------------
  const organization = await prisma.organization.findUnique({
    where: {
      subdomain: cleanDepartment,
    },
  });

  if (!organization) {
    throw new Error('Department not found.');
  }

  // ---------------------------------------------------------
  // 2. Find the user INSIDE this department
  // ---------------------------------------------------------
  const user = await prisma.tenantUser.findFirst({
    where: {
      organizationId: organization.id,
      email: cleanEmail,
      status: 'Active',
    },
  });

  if (!user) {
    throw new Error(
      'This account is not registered or is currently inactive.'
    );
  }

  // ---------------------------------------------------------
  // 3. Check SMTP configuration BEFORE creating OTP
  // ---------------------------------------------------------
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const mailFrom = process.env.MAIL_FROM;

  if (
    !smtpHost ||
    !smtpUser ||
    !smtpPassword ||
    !mailFrom
  ) {
    console.error('Missing SMTP configuration.');
    throw new Error(
      'Email service is not configured.'
    );
  }

  // ---------------------------------------------------------
  // 4. Generate secure 6-digit OTP
  // ---------------------------------------------------------
  const otp = crypto
    .randomInt(100000, 1000000)
    .toString();

  const otpExpires = new Date(
    Date.now() + 5 * 60 * 1000
  );

  // ---------------------------------------------------------
  // 5. Store OTP in Prisma
  //
  // This is what auth.ts will check later.
  // ---------------------------------------------------------
  await prisma.tenantUser.update({
    where: {
      id: user.id,
    },
    data: {
      otpCode: otp,
      otpExpires,
    },
  });

  // ---------------------------------------------------------
  // 6. Send email
  // ---------------------------------------------------------
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });

  try {
    await transporter.sendMail({
      from: mailFrom,
      to: cleanEmail,
      subject: `CLEAR System: ${organization.name} Verification Code`,
      html: `
        <div style="
          font-family: Arial, sans-serif;
          max-width: 600px;
          margin: auto;
          padding: 30px;
          border: 1px solid #ddd;
          border-radius: 12px;
        ">
          <h2 style="margin-bottom: 5px;">
            CLEAR System
          </h2>

          <p>
            Department: <strong>${organization.name}</strong>
          </p>

          <p>
            Your verification code is:
          </p>

          <div style="
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 8px;
            padding: 20px;
            text-align: center;
            background: #f5f5f5;
            border-radius: 8px;
            margin: 20px 0;
          ">
            ${otp}
          </div>

          <p>
            This code will expire in
            <strong>5 minutes</strong>.
          </p>

          <p style="color:#777;font-size:13px;">
            If you did not request this verification code,
            you can safely ignore this email.
          </p>
        </div>
      `,
    });
  } catch (error) {
    // If email sending fails, invalidate the OTP
    await prisma.tenantUser.update({
      where: {
        id: user.id,
      },
      data: {
        otpCode: null,
        otpExpires: null,
      },
    });

    console.error('OTP email error:', error);

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