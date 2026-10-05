'use server';

import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

export async function requestOtp(department: string, email: string) {
  const cleanEmail = email.trim().toLowerCase();
  
  const organization = await prisma.organization.findUnique({ 
    where: { subdomain: department.toLowerCase() } 
  });
  
  if (!organization) throw new Error("Department not found.");

  const user = await prisma.tenantUser.findFirst({
    where: { organizationId: organization.id, email: cleanEmail, status: 'Active' }
  });
  
  if (!user) throw new Error("This account is not registered or is currently inactive.");

  // Check 10-minute Lockout constraint
  const cookieStore = await cookies();
  const lockout = cookieStore.get('fcu_lockout')?.value;
  if (lockout && parseInt(lockout) > Date.now()) {
    const minutesLeft = Math.ceil((parseInt(lockout) - Date.now()) / 60000);
    throw new Error(`Account locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`);
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Hash the OTP so it cannot be read from the client's browser cookies
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

  // Set 5-Minute Expiry Cookies
  cookieStore.set('fcu_otp_hash', otpHash, { maxAge: 300, httpOnly: true });
  cookieStore.set('fcu_otp_email', cleanEmail, { maxAge: 300, httpOnly: true });
  cookieStore.set('fcu_otp_strikes', '0', { maxAge: 300, httpOnly: true });

  // ---------------------------------------------------------------------------
  // GMAIL SMTP DISPATCH LOGIC
  // ---------------------------------------------------------------------------
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;

  if (!smtpUser || !smtpPassword) {
    console.error("Missing SMTP Credentials");
    throw new Error("Email service is not configured. Please restart your Next.js server.");
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_PORT === '465', 
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM, 
    to: cleanEmail,
    subject: `CLEAR System: ${organization.name || 'Department'} Verification Code`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #0dcaf0; margin-bottom: 20px;">CLEAR System Authorization</h2>
        <p style="color: #555; font-size: 15px;">You are attempting to securely sign in to your department workspace.</p>
        <p style="color: #555; font-size: 15px;">Your one-time verification code is:</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 6px; margin: 25px 0;">
          <h1 style="letter-spacing: 8px; margin: 0; color: #212529; font-size: 32px;">${otp}</h1>
        </div>
        
        <p style="color: #777; font-size: 13px; margin-top: 30px;">
          This code will expire in 5 minutes. If you did not request this access, please ignore this email.
        </p>
      </div>
    `,
  });
  // ---------------------------------------------------------------------------

  return { success: true, message: `A 6-digit verification code has been dispatched to ${cleanEmail}.` };
}

export async function verifyOtp(department: string, email: string, otp: string) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = otp.trim();
  const cookieStore = await cookies();

  // 1. Check Lockout
  const lockout = cookieStore.get('fcu_lockout')?.value;
  if (lockout && parseInt(lockout) > Date.now()) {
    throw new Error("Account is currently locked. Please wait 10 minutes.");
  }

  const storedHash = cookieStore.get('fcu_otp_hash')?.value;
  const storedEmail = cookieStore.get('fcu_otp_email')?.value;
  let strikes = parseInt(cookieStore.get('fcu_otp_strikes')?.value || '0');

  // 2. Check 5-Minute Expiry
  if (!storedHash || storedEmail !== cleanEmail) {
    throw new Error("Verification code has expired or was not requested. Please request a new one.");
  }

  const inputHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');

  // 3. Process Failed Attempts (5 strikes = 10 min lockout)
  if (inputHash !== storedHash) {
    strikes += 1;
    if (strikes >= 5) {
      // Apply 10 minute lockout
      cookieStore.set('fcu_lockout', (Date.now() + 10 * 60 * 1000).toString(), { maxAge: 600, httpOnly: true });
      cookieStore.delete('fcu_otp_hash');
      throw new Error("Maximum attempts reached. Account locked for 10 minutes.");
    }
    cookieStore.set('fcu_otp_strikes', strikes.toString(), { maxAge: 300, httpOnly: true });
    throw new Error(`Incorrect verification code. You have ${5 - strikes} attempt(s) remaining.`);
  }

  // 4. Success: Clear OTP Cookies and establish Session
  cookieStore.delete('fcu_otp_hash');
  cookieStore.delete('fcu_otp_strikes');
  cookieStore.delete('fcu_lockout');

  const user = await prisma.tenantUser.findFirst({
    where: { email: cleanEmail, status: 'Active' }
  });

  if (!user) throw new Error("User record no longer available.");

  // Establish a 6-hour auth session cookie
  const sessionToken = crypto.randomBytes(32).toString('hex');
  cookieStore.set('fcu_session', sessionToken, { maxAge: 21600, httpOnly: false });

  return {
    success: true,
    user: {
      userId: user.userId,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      role: user.role,
      allowedTabs: user.allowedTabs ? JSON.parse(user.allowedTabs as string) : []
    }
  };
}