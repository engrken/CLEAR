// /app/department/[department]/auth-actions.ts
'use server';

import { prisma } from '@/lib/prisma';
import crypto from 'node:crypto';
import { sendEmail } from '@/lib/mailer';
import { isSuperAdminEmail } from '@/lib/permissions';
import { ThrottleError, assertCanSendOtp, otpThrottleKey, recordOtpSent } from '@/lib/auth-throttle';
import { OtpError, findOrganizationBySlug, sendDepartmentOtp } from '@/lib/otp';

export type RequestOtpResult =
  | { success: true; message: string }
  | { success: false; code: string; message: string };

// Expected failures (unknown officer, cooldown, lockout, email failure) are
// returned, not thrown: production builds replace a thrown server-action error
// with a generic React error, so the sign-in modal could not show the reason.
class RequestOtpError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

export async function requestOtp(
  department: string,
  email: string
): Promise<RequestOtpResult> {
  try {
    return await sendRequestedOtp(department, email);
  } catch (err) {
    if (err instanceof OtpError || err instanceof ThrottleError || err instanceof RequestOtpError) {
      return { success: false, code: err.code, message: err.message };
    }
    throw err;
  }
}

async function sendRequestedOtp(
  department: string,
  email: string
): Promise<RequestOtpResult> {
  const cleanDepartment = decodeURIComponent(department)
    .trim()
    .toLowerCase();
  const cleanEmail = String(email || '').trim().toLowerCase();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new RequestOtpError('Please provide a valid email address.', 'invalid');
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
    const throttleKey = otpThrottleKey('superadmin', cleanEmail);
    await assertCanSendOtp(throttleKey);

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
      throw new RequestOtpError('Unable to send verification email. Please try again.', 'send_failed');
    }
    await recordOtpSent(throttleKey);
    return {
      success: true,
      message: 'A verification code has been sent to your registered email address.',
    };
  }

  // =========================================================
  // DEPARTMENT OFFICER (shared with the mobile API: lib/otp.ts)
  // =========================================================
  const organization = await findOrganizationBySlug(cleanDepartment);
  if (!organization) {
    throw new RequestOtpError('Department not found.', 'not_found');
  }

  await sendDepartmentOtp(organization, cleanEmail);

  return {
    success: true,
    message: 'A verification code has been sent to your registered email address.',
  };
}
