// /app/api/entity-admin/login/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanEmail) {
      return NextResponse.json({ success: false, message: 'Email address is required.' }, { status: 400 });
    }

    // Check if a TenantUser exists with this email and has admin privileges
    const tenantUser = await prisma.tenantUser.findFirst({
      where: { 
        email: cleanEmail,
        role: 'admin'
      },
      include: { organization: true }
    });

    if (!tenantUser) {
      return NextResponse.json({ 
        success: false, 
        message: 'No administrative account found for this email address.' 
      }, { status: 404 });
    }

    // Success response (In production, you can also bind this to your NextAuth session or set a cookie)
    return NextResponse.json({ 
      success: true, 
      message: 'Authentication successful',
      organization: tenantUser.organization.name,
      schoolGroup: tenantUser.organization.schoolGroup
    });

  } catch (error: any) {
    console.error('Entity admin login error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Internal server error during authentication.' 
    }, { status: 500 });
  }
}