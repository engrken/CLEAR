// /app/api/entity-admin/login/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { signEntityToken, verifyEntityToken } from '@/app/dashboard/entity/actions';

async function dispatchOtpEmail(toEmail: string, otpCode: string, orgName: string): Promise<void> {
  const smtpUser =
    process.env.GMAIL_USER ||
    process.env.EMAIL_USER ||
    process.env.SMTP_USER ||
    process.env.MAIL_USER;

  const smtpPass =
    process.env.GMAIL_APP_PASSWORD ||
    process.env.GMAIL_PASS ||
    process.env.EMAIL_PASS ||
    process.env.SMTP_PASSWORD ||
    process.env.MAIL_PASS;

  if (!smtpUser || !smtpPass) {
    throw new Error(
      'Gmail SMTP credentials are not configured in environment variables.'
    );
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await transporter.sendMail({
    from: `"CLEAR System Security" <${smtpUser}>`,
    to: toEmail,
    subject: `[CLEAR System] Entity Admin OTP Code: ${otpCode}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #334155;">
        <h2 style="color: #38bdf8; margin-top: 0;">Entity Admin Portal Verification</h2>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">
          You requested administrative access to manage the institutional entity group associated with <strong>${orgName}</strong>.
        </p>
        <div style="background-color: #1e293b; border: 1px solid #38bdf8; padding: 16px; border-radius: 8px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #38bdf8; margin: 20px 0;">
          ${otpCode}
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
          This verification code expires in 5 minutes. If you did not request this code, please ignore this email.
        </p>
      </div>
    `,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cleanEmail = String(body.email || '').trim().toLowerCase();
    const step = String(body.step || 'request_otp');
    const submittedOtp = String(body.otpCode || '').trim();

    if (!cleanEmail) {
      return NextResponse.json(
        { success: false, message: 'Administrator email address is required.' },
        { status: 400 }
      );
    }

    const tenantUser = await prisma.tenantUser.findFirst({
      where: {
        email: cleanEmail,
        role: 'admin',
      },
      include: { organization: true },
    });

    if (!tenantUser) {
      return NextResponse.json(
        {
          success: false,
          message: 'No Entity Administrator account found for this email address.',
        },
        { status: 404 }
      );
    }

    const cookieStore = await cookies();

    if (step === 'request_otp') {
      const generatedOtp = String(crypto.randomInt(100000, 999999));
      const otpHash = crypto
        .createHash('sha256')
        .update(`${cleanEmail}:${generatedOtp}`)
        .digest('hex');

      const signedChallenge = await signEntityToken({
        email: cleanEmail,
        otpHash,
        exp: Date.now() + 5 * 60 * 1000,
      });

      cookieStore.set('clear_entity_otp', signedChallenge, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 300, // 5 minutes
      });

      await dispatchOtpEmail(cleanEmail, generatedOtp, tenantUser.organization.name);

      return NextResponse.json({
        success: true,
        message: `A 6-digit verification code has been sent to your Gmail (${cleanEmail}).`,
      });
    }

    if (step === 'verify_otp') {
      const challengeCookie = cookieStore.get('clear_entity_otp')?.value;
      const challenge = await verifyEntityToken<{ email: string; otpHash: string; exp: number }>(
        challengeCookie
      );

      if (!challenge || challenge.email !== cleanEmail) {
        return NextResponse.json(
          { success: false, message: 'OTP session expired or invalid. Please request a new OTP.' },
          { status: 400 }
        );
      }

      const expectedHash = crypto
        .createHash('sha256')
        .update(`${cleanEmail}:${submittedOtp}`)
        .digest('hex');

      if (challenge.otpHash !== expectedHash) {
        return NextResponse.json(
          { success: false, message: 'Invalid 6-digit OTP code entered.' },
          { status: 401 }
        );
      }

      cookieStore.delete('clear_entity_otp');

      const sessionToken = await signEntityToken({
        email: cleanEmail,
        role: 'admin',
        exp: Date.now() + 24 * 60 * 60 * 1000,
      });

      cookieStore.set('clear_entity_session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24, // 24 hours
      });

      return NextResponse.json({
        success: true,
        message: 'OTP verified. Redirecting to Entity Admin Portal...',
      });
    }

    return NextResponse.json(
      { success: false, message: 'Invalid authentication step.' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Entity Admin Auth Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to send verification email.' },
      { status: 500 }
    );
  }
}