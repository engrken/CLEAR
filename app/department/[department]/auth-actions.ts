//department/[department]/auth-actions.ts
'use server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
const SUPER_ADMIN_EMAIL = 'kent.bsece@gmail.com';
export async function requestOtp(
  department: string,
  email: string
) {
  const cleanDepartment = decodeURIComponent(
    department
  )
    .trim()
    .toLowerCase();
  const cleanEmail = email
    .trim()
    .toLowerCase();
  console.log('========== REQUEST OTP ==========');
  console.log('OTP EMAIL:', cleanEmail);
  console.log('OTP DEPARTMENT:', cleanDepartment);

  // =========================================================
  // SMTP CONFIGURATION
  // =========================================================
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(
    process.env.SMTP_PORT || '587'
  );
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const mailFrom = process.env.MAIL_FROM;
  if (
    !smtpHost ||
    !smtpUser ||
    !smtpPassword ||
    !mailFrom
  ) {
    console.error(
      'Missing SMTP configuration.'
    );
    throw new Error(
      'Email service is not configured.'
    );
  }

  // =========================================================
  // GENERATE OTP
  // =========================================================
  const otp = crypto
    .randomInt(100000, 1000000)
    .toString();
  const otpExpires = new Date(
    Date.now() + 5 * 60 * 1000
  );

  // =========================================================
  // SUPER ADMIN
  // =========================================================
  if (cleanEmail === SUPER_ADMIN_EMAIL) {
    console.log(
      'OTP MODE: SUPER ADMIN'
    );

    // The VerificationToken model uses identifier as its primary key, so use the email as identifier.
    await prisma.verificationToken.upsert({
      where: {
        identifier: cleanEmail,
      },
      update: {
        token: otp,
        expires: otpExpires,
      },
      create: {
        identifier: cleanEmail,
        token: otp,
        expires: otpExpires,
      },
    });
    const transporter =
      nodemailer.createTransport({
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
        subject:
          'CLEAR System: System Admin Verification Code',
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
      });
      console.log(
        'SUPER ADMIN OTP EMAIL SENT.'
      );
    } catch (error) {
      console.error(
        'Super Admin OTP email error:',
        error
      );
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
    console.log(
      '========== REQUEST OTP SUCCESS =========='
    );
    return {
      success: true,
      message:
        'A verification code has been sent to your registered email address.',
    };
  }

  // =========================================================
  // FIND ORGANIZATION
  // =========================================================
  const organization =
    await prisma.organization.findUnique({
      where: {
        subdomain: cleanDepartment,
      },
    });
  if (!organization) {
    console.error(
      'Organization not found:',
      cleanDepartment
    );
    throw new Error(
      'Department not found.'
    );
  }
  console.log(
    'OTP ORGANIZATION:',
    organization.id
  );

  // =========================================================
  // FIND DEPARTMENT USER
  // =========================================================
  const user =
    await prisma.tenantUser.findFirst({
      where: {
        organizationId:
          organization.id,
        email: cleanEmail,
        status: 'Active',
      },
    });
  if (!user) {
    console.error(
      'Department user not found:',
      cleanEmail
    );
    throw new Error(
      'This account is not registered or is currently inactive.'
    );
  }
  console.log(
    'OTP USER FOUND:',
    user.id
  );

  // =========================================================
  // STORE DEPARTMENT USER OTP
  // =========================================================
  await prisma.tenantUser.update({
    where: {
      id: user.id,
    },
    data: {
      otpCode: otp,
      otpExpires,
    },
  });
  console.log(
    'DEPARTMENT OTP STORED.'
  );

  // =========================================================
  // SEND EMAIL
  // =========================================================
  const transporter =
    nodemailer.createTransport({
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
      subject:
        `CLEAR System: ${organization.name} Verification Code`,
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
              <strong>${organization.name}</strong>is:
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
    });
    console.log(
      'DEPARTMENT OTP EMAIL SENT.'
    );
  } catch (error) {
    console.error(
      'OTP email error:',
      error
    );
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
  console.log(
    '========== REQUEST OTP SUCCESS =========='
  );
  return {
    success: true,
    message:
      'A verification code has been sent to your registered email address.',
  };
}