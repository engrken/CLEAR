// /app/api/entity-admin/login/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { signEntityToken, verifyEntityToken } from '@/app/dashboard/entity/actions';

async function dispatchOtpEmail(toEmail: string, otpCode: string, orgName: string): Promise<boolean> {
  // Check if Resend API Key is configured
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'CLEAR System <onboarding@resend.dev>',
          to: [toEmail],
          subject: `[CLEAR System] Your Entity Admin OTP Code: ${otpCode}`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #0f172a; margin-top: 0;">CLEAR Entity Admin Verification</h2>
              <p style="color: #475569; font-size: 14px;">You requested access to the Entity Management Portal for <strong>${orgName}</strong>.</p>
              <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #0284c7; margin: 20px 0;">
                ${otpCode}
              </div>
              <p style="color: #64748b; font-size: 12px;">This code expires in 5 minutes. If you did not request this login, please ignore this email.</p>
            </div>
          `,
        }),
      });
      if (res.ok) return true;
    } catch (e) {
      console.error('Resend dispatch failed:', e);
    }
  }

  console.log(`[CLEAR ENTITY OTP] Email: ${toEmail} | Code: ${otpCode}`);
  return false;
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

    // Verify user is an active admin of at least one entity
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
      const otpHash = crypto.createHash('sha256').update(`${cleanEmail}:${generatedOtp}`).digest('hex');

      // Store stateless signed OTP challenge in an HTTP-only cookie valid for 5 minutes
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

      const emailSent = await dispatchOtpEmail(cleanEmail, generatedOtp, tenantUser.organization.name);

      return NextResponse.json({
        success: true,
        emailDispatched: emailSent,
        // If no email provider is configured yet, return devOtp so you don't get locked out in production testing
        devOtp: !emailSent ? generatedOtp : undefined,
        message: emailSent
          ? `A 6-digit verification code has been sent to ${cleanEmail}.`
          : 'OTP generated (Email provider not bound yet — use verification code shown).',
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

      // Clear the OTP challenge cookie
      cookieStore.delete('clear_entity_otp');

      // Issue a cryptographically signed 24-hour session cookie
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

    return NextResponse.json({ success: false, message: 'Invalid authentication step.' }, { status: 400 });
  } catch (error: any) {
    console.error('Entity Admin Auth Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error during authentication.' },
      { status: 500 }
    );
  }
}