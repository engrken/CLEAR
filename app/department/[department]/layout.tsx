
// /app/department/[department]/layout.tsx

import type { ReactNode } from 'react';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { verifyGlobalAdminSession } from '@/lib/super-admin';

import DepartmentSidebar from '@/app/department/[department]/Sidebar';
import TopHeader from '@/app/department/[department]/TopHeader';
import Footer from '@/app/department/[department]/components/Footer';

interface ProtectedDepartmentLayoutProps {
  children: ReactNode;
  params: Promise<{ department: string }>;
}

interface ExtendedUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  username?: string | null;
  role?: string;
  organizationId?: string | null;
  department?: string | null;
  allowedTabs?: string[];
  globalAdminId?: string | null;
  globalAdminVersion?: number | null;
}

export default async function ProtectedDepartmentLayout({
  children,
  params,
}: ProtectedDepartmentLayoutProps) {
  const { department } = await params;

  let cleanDepartment: string;

  try {
    cleanDepartment = decodeURIComponent(String(department || ''))
      .trim()
      .toLowerCase();
  } catch {
    return (
      <div className="d-flex min-vh-100 align-items-center justify-content-center">
        <h2>Invalid Department</h2>
      </div>
    );
  }

  if (
    !cleanDepartment ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(cleanDepartment)
  ) {
    return (
      <div className="d-flex min-vh-100 align-items-center justify-content-center">
        <h2>Invalid Department</h2>
      </div>
    );
  }

  const session = await auth();

  // Preserve public department pages that do not require a login.
  // Protected pages must enforce their own server-side authorization.
  if (!session?.user) {
    return <>{children}</>;
  }

  const authUser = session.user as ExtendedUser;
  const email = String(authUser.email || '').trim().toLowerCase();
  const userRole = String(authUser.role || 'officer')
    .trim()
    .toLowerCase();

  // A tenant's outer layout must use the same database-verified global
  // session identity as the protected server actions. The old email-only
  // bootstrap check denied promoted/global administrators in the UI.
  // Do not trust a SuperAdmin role or reserved email by itself: disabled,
  // revoked or outdated sessions must fail closed.
  const globalIdentity = await verifyGlobalAdminSession({
    email,
    role: authUser.role,
    globalAdminId: authUser.globalAdminId,
    globalAdminVersion: authUser.globalAdminVersion,
  });
  const isSuperAdmin = Boolean(globalIdentity);

  const allowedTabs = Array.isArray(authUser.allowedTabs)
    ? authUser.allowedTabs.filter(
        (tab): tab is string => typeof tab === 'string'
      )
    : [];

  const currentUser = {
    id: authUser.id || '',
    fullName: authUser.name || 'Department Officer',
    username: authUser.username || 'N/A',
    role: authUser.role || 'OFFICER',
    email,
    organizationId: authUser.organizationId || '',
    department: authUser.department || cleanDepartment,
    allowedTabs,
    isSuperAdmin,
  };

  const organization = await prisma.organization.findUnique({
    where: {
      subdomain: cleanDepartment,
    },
    select: {
      id: true,
      name: true,
      logo: true,
      activeAy: true,
      activeTerm: true,
      status: true,
    },
  });

  if (!organization) {
    return (
      <div className="container-fluid p-4">
        <div className="alert alert-danger shadow-sm border-secondary">
          <h4 className="fw-bold mb-2">Department Not Found</h4>
          <p className="small mb-0">
            The department &quot;{cleanDepartment}&quot; does not exist
            in the database.
          </p>
        </div>
      </div>
    );
  }

  const academicCalendars = await prisma.academicPeriodConfig.findMany({
    where: { organizationId: organization.id },
    select: { academicYear: true, mode: true, includeSummer: true },
  });
  const calendarConfigs = Object.fromEntries(academicCalendars.map(c => [c.academicYear, {
    mode: c.mode as "Semester" | "Trimester" | "FullYear", includeSummer: c.includeSummer,
  }]));

  const allowedRoles = new Set([
    'admin',
    'administrator',
    'master',
    'auditor',
    'audit',
    'treasurer',
    'viewer',
    'superadmin',
    'officer',
  ]);

  let isForbidden = false;
  let forbiddenReason = '';

  if (!email) {
    isForbidden = true;
    forbiddenReason = 'Your session does not contain a valid email address.';
  } else if (!allowedRoles.has(userRole)) {
    isForbidden = true;
    forbiddenReason = 'Your role is not permitted to access the CLEAR System.';
  } else if (
    organization.status !== 'Active' &&
    !isSuperAdmin
  ) {
    isForbidden = true;
    forbiddenReason = 'This department is inactive or unavailable.';
  } else if (
    !isSuperAdmin &&
    (
      !authUser.organizationId ||
      authUser.organizationId !== organization.id
    )
  ) {
    isForbidden = true;
    forbiddenReason =
      'You are not authorized to view records for this department.';
  }

  return (
    <div
      className="d-flex min-vh-100"
      style={{
        width: '100%',
        minWidth: 0,
      }}
    >
      <DepartmentSidebar
        department={cleanDepartment}
        orgName={organization.name}
        logoUrl={organization.logo}
        currentUser={currentUser}
        aiVisible={process.env.CLEAR_AI_ENABLED === 'true' && process.env.CLEAR_AI_DATA_PROCESSING_APPROVED === 'true'}
        defaultAy={organization.activeAy || undefined}
        defaultTerm={organization.activeTerm || undefined}
      />

      <div
        className="flex-grow-1 d-flex flex-column"
        style={{
          minWidth: 0,
          width: '100%',
        }}
      >
        <TopHeader
          department={cleanDepartment}
          currentUser={currentUser}
          defaultAy={organization.activeAy || undefined}
          defaultTerm={organization.activeTerm || undefined}
          calendarConfigs={calendarConfigs}
        />

        <main
          className="flex-grow-1 p-3 p-md-4"
          style={{
            minWidth: 0,
          }}
        >
          {isForbidden ? (
            <div className="alert alert-danger shadow-sm border-secondary">
              <h4 className="fw-bold mb-2">
                <i className="bi bi-shield-lock-fill me-2" />
                Access Denied
              </h4>
              <p className="small mb-0">{forbiddenReason}</p>
            </div>
          ) : (
            children
          )}
        </main>

        <Footer buildId={(process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || '').trim().slice(0, 7)} />
      </div>
    </div>
  );
}
