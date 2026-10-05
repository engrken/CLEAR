// app/department/[department]/layout.tsx
import { ReactNode } from 'react';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import DepartmentSidebar from './Sidebar';
import TopHeader from './TopHeader';
import Footer from './components/Footer';
import DataPrivacyModal from './components/DataPrivacyModal';

export default async function DepartmentLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ department: string }>;
}) {
  const { department } = await params;
  const cleanDepartment = decodeURIComponent(department).toLowerCase().trim();

  // =========================================================
  // 1. STRICT LOGIN & PERMISSION CHECK (Protects all subpages)
  // =========================================================
  const session = await auth();

  if (!session?.user) {
    redirect(`/department/${encodeURIComponent(cleanDepartment)}?login=true`);
  }

  const userWithRole = session.user as typeof session.user & { role?: string };
  const userRole = userWithRole.role?.toLowerCase() || 'viewer';
  
  const allowedRoles = ['admin', 'administrator', 'master', 'auditor', 'audit'];

  if (!allowedRoles.includes(userRole)) {
    redirect(`/department/${encodeURIComponent(cleanDepartment)}?forbidden=true`);
  }

  // =========================================================
  // 2. VERIFY DEPARTMENT EXISTS
  // =========================================================
  const organization = await prisma.organization.findUnique({
    where: {
      subdomain: cleanDepartment,
    },
  });

  if (!organization) {
    return (
      <div className="container p-4">
        <div className="alert alert-danger shadow-sm border-secondary">
          <h4 className="fw-bold mb-2">Department Not Found</h4>
          <p className="small mb-0">
            The department '{decodeURIComponent(department)}' does not exist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex min-vh-100">
      <DepartmentSidebar department={department} />

      <div className="flex-grow-1 d-flex flex-column" style={{ minWidth: 0 }}>
        <TopHeader department={department} />

        <main className="flex-grow-1 p-3 p-md-4">
          {children}
        </main>
        
        <Footer />
        <DataPrivacyModal />
      </div>
    </div>
  );
}