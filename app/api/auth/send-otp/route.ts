import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Adjust path based on your folder structure

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    // 1. Strict Security Gate
    if (email !== 'kent.bsece@gmail.com') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized super administrator email.' },
        { status: 403 }
      );
    }

    // 2. Generate a 6-digit numeric OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    // Set expiration to 5 minutes from now
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    // 3. Save or Update the OTP in the database
    await prisma.verificationToken.upsert({
      where: { identifier: email },
      update: {
        token: otpCode,
        expires: expires,
      },
      create: {
        identifier: email,
        token: otpCode,
        expires: expires,
      },
    });

    // 4. Dispatch the email via Resend using native fetch API
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'CLEAR System <onboarding@resend.dev>', // Use onboarding@resend.dev for testing, or your verified domain
        to: [email],
        subject: 'CLEAR System: Super Admin Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #0dcaf0; margin-bottom: 20px;">CLEAR System Authorization</h2>
            <p style="color: #555; font-size: 15px;">You are attempting to access the Super Admin Setup Module.</p>
            <p style="color: #555; font-size: 15px;">Your one-time verification code is:</p>
            
            <div style="background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 6px; margin: 25px 0;">
              <h1 style="letter-spacing: 8px; margin: 0; color: #212529; font-size: 32px;">${otpCode}</h1>
            </div>
            
            <p style="color: #777; font-size: 13px; margin-top: 30px;">
              This code will expire in 5 minutes. If you did not request this access, please ignore this email.
            </p>
          </div>
        `,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error('Resend Fetch Error:', resendData);
      return NextResponse.json(
        { success: false, message: 'Failed to dispatch email via Resend API.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'OTP securely dispatched to your inbox.' 
    });

  } catch (error) {
    console.error('Send OTP Server Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error during OTP generation.' },
      { status: 500 }
    );
  }
}