// /app/api/auth/send-otp/route.ts  (REPLACES existing)
// Your hashing fix is kept (now inside lib/super-admin-otp.ts). Added: cooldown, hourly cap, lock
// awareness, and the same response for every email so the route can no longer be used to learn
// which address is the Super Admin.
import { NextResponse } from 'next/server';
import { issueSuperAdminOtp } from '@/lib/super-admin-otp';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await issueSuperAdminOtp(String(body?.email || ''));
    return NextResponse.json(result);
  } catch (error) {
    console.error('Send OTP Server Error:', error);
    return NextResponse.json(
      { success: false, message: 'Unable to process the request.' },
      { status: 500 }
    );
  }
}
