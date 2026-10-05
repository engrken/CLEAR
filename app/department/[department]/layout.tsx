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
  // 1. VERIFY DEPARTMENT EXISTS FIRST
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