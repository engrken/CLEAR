// This narrow authentication endpoint is permitted in READ_ONLY mode.
// Financial/profile/provisioning Server Actions are never exempted by it.
import { NextResponse, type NextRequest } from 'next/server';
import { issueDepartmentOtp } from '@/lib/department-otp';

type Context = { params: Promise<{ department: string }> };
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: Context) {
  const { department } = await params;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(department)) {
    return NextResponse.json({ success: false, message: 'Invalid department.' }, { status: 400 });
  }
  // Do not admit large unauthenticated JSON bodies to the OTP provider.
  const length = Number(request.headers.get('content-length') || '0');
  if (length > 2048) {
    return NextResponse.json({ success: false, message: 'Invalid request.' }, { status: 413 });
  }
  try {
    const raw = await request.text();
    if (raw.length > 2048) {
      return NextResponse.json({ success: false, message: 'Invalid request.' }, { status: 413 });
    }
    const body = JSON.parse(raw) as Record<string, unknown>;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, message: 'Enter a valid email address.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
    // Normal tenant and eligible Global Administrator accounts retain the
    // existing unified OTP/rate-limit logic. OTP verification uses NextAuth.
    const result = await issueDepartmentOtp(department, email);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // Avoid exposing SMTP internals, account eligibility or OTP secrets.
    return NextResponse.json({ success: false, message: 'Unable to issue a verification code. Please try again later.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
