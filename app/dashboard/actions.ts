// /app/dashboard/entity/actions.ts
'use server';

import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import crypto from 'crypto';

const SECRET_KEY = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'clear-saas-institutional-secret-key-2026';

export async function signEntityToken(payload: object): Promise<string> {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(data)
    .digest('base64url');
  return `${data}.${signature}`;
}

export async function verifyEntityToken<T = any>(token: string | undefined): Promise<T | null> {
  if (!token || !token.includes('.')) return null;
  const [data, signature] = token.split('.');
  const expectedSig = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(data)
    .digest('base64url');

  if (signature !== expectedSig) return null;

  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    if (parsed.exp && Date.now() > parsed.exp) return null;
    return parsed as T;
  } catch {
    return null;
  }
}

export async function getAuthenticatedEntityAdmin(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('clear_entity_session')?.value;
  const verified = await verifyEntityToken<{ email: string }>(sessionToken);
  return verified?.email || null;
}

export async function provisionSubEntityAction(formData: FormData) {
  const email = await getAuthenticatedEntityAdmin();
  if (!email) {
    throw new Error('Unauthorized: Your Entity Admin session has expired. Please log in again.');
  }

  // Verify the admin exists and fetch their primary organization
  const primaryAdminRecord = await prisma.tenantUser.findFirst({
    where: { email, role: 'admin' },
    include: { organization: true },
  });

  if (!primaryAdminRecord) {
    throw new Error('Unauthorized: Admin record not found.');
  }

  const name = String(formData.get('name') || '').trim();
  const subdomain = String(formData.get('subdomain') || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  const type = String(formData.get('type') || 'Department').trim();
  const customGroup = String(formData.get('schoolGroup') || '').trim().toLowerCase();

  if (!name || !subdomain) {
    throw new Error('Entity Name and Subdomain Slug are required.');
  }

  if (!/^[a-z0-9-]+$/.test(subdomain)) {
    throw new Error('Subdomain slug may only contain lowercase letters, numbers, and hyphens.');
  }

  const existingSlug = await prisma.organization.findUnique({
    where: { subdomain },
  });

  if (existingSlug) {
    throw new Error(`The subdomain '/department/${subdomain}' is already taken.`);
  }

  // Determine effective schoolGroup
  let targetSchoolGroup = primaryAdminRecord.organization.schoolGroup;
  if (targetSchoolGroup === 'default-school' && customGroup && customGroup !== 'default-school') {
    targetSchoolGroup = customGroup;
    // Upgrade their existing organization out of 'default-school' so they are properly grouped
    await prisma.organization.update({
      where: { id: primaryAdminRecord.organizationId },
      data: { schoolGroup: targetSchoolGroup },
    });
  }

  const currentTier = primaryAdminRecord.organization.tier || 'Freemium';
  const maxAllowed = currentTier === 'Freemium' ? 2 : currentTier === 'Pro' ? 10 : 999;

  // Count existing entities in this school group
  const existingGroupCount =
    targetSchoolGroup === 'default-school'
      ? 1
      : await prisma.organization.count({
          where: { schoolGroup: targetSchoolGroup },
        });

  if (existingGroupCount >= maxAllowed) {
    throw new Error(
      `Tier limit reached: Your ${currentTier} plan allows up to ${maxAllowed} entities for group '${targetSchoolGroup}'.`
    );
  }

  const defaultTabs = [
    'tab-overview', 'tab-students', 'tab-clearance', 'tab-payment',
    'tab-remittances', 'tab-penalties', 'tab-advances', 'tab-audit',
    'tab-collectibles', 'tab-reports', 'tab-void', 'tab-report',
    'tab-transfer', 'tab-users', 'tab-setup',
  ];

  // Atomically create the new Organization AND link the Entity Admin as its initial TenantUser
  await prisma.$transaction(async (tx) => {
    const newOrg = await tx.organization.create({
      data: {
        name,
        subdomain,
        schoolGroup: targetSchoolGroup,
        tier: currentTier,
        type,
        status: 'Active',
      },
    });

    await tx.tenantUser.create({
      data: {
        organizationId: newOrg.id,
        userId: `USR-${subdomain.toUpperCase()}-001`,
        fullName: primaryAdminRecord.fullName,
        username: `${primaryAdminRecord.username}_${subdomain}`.slice(0, 30),
        email: primaryAdminRecord.email,
        role: 'admin',
        allowedTabs: JSON.stringify(defaultTabs),
        status: 'Active',
      },
    });
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/provisions');
  revalidatePath('/dashboard/entity/portal');
}

export async function logoutEntityAdminAction() {
  const cookieStore = await cookies();
  cookieStore.delete('clear_entity_session');
  cookieStore.delete('clear_entity_otp');
  redirect('/dashboard/entity/login');
}