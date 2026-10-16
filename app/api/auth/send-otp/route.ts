// /app/api/auth/send-otp/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/mailer'; 
import { isSuperAdminEmail } from '@/lib/permissions'; 
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    const cleanEmail = String(email || '').trim().toLowerCase();

    // 1. Strict Security Gate
    if (!isSuperAdminEmail(cleanEmail)) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized super administrator email.' },
        { status: 403 }
      );
    }

    // 2. Generate a 6-digit cryptographic numeric OTP
    const otpCode = crypto.randomInt(100000, 1000000).toString();

    // 🚀 FIX: Hash the OTP with SHA-256 before saving to match auth.ts verification expectations
    const hashedOtp = crypto.createHash('sha256').update(otpCode).digest('hex');

    // Set expiration to 5 minutes from now
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    // 3. Save or Update the HASHED OTP in the database
    await prisma.verificationToken.upsert({
      where: { identifier: cleanEmail },
      update: {
        token: hashedOtp,
        expires: expires,
      },
      create: {
        identifier: cleanEmail,
        token: hashedOtp,
        expires: expires,
      },
    });

    // 4. Dispatch the email containing the PLAINTEXT otpCode to the user
    await sendEmail({
      to: cleanEmail,
      subject: 'CLEAR System: System Admin Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #0dcaf0; margin-bottom: 20px;">CLEAR System Authorization</h2>
          <p style="color: #555; font-size: 15px;">You are attempting to access the System Admin Setup Module.</p>
          <p style="color: #555; font-size: 15px;">Your one-time verification code is:</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 6px; margin: 25px 0;">
            <h1 style="letter-spacing: 8px; margin: 0; color: #212529; font-size: 32px;">${otpCode}</h1>
          </div>
          
          <p style="color: #777; font-size: 13px; margin-top: 30px;">
            This code will expire in 5 minutes. If you did not request this access, please ignore this email.
          </p>
        </div>
      `,
      text: `Your CLEAR System verification code is: ${otpCode}`,
    });

    return NextResponse.json({ 
      success: true, 
      message: 'OTP securely dispatched to your inbox.' 
    });

  } catch (error) {
    console.error('Send OTP Server Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error during OTP dispatch.' },
      { status: 500 }
    );
  }
}