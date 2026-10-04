// app/department/[department]/layout.tsx
import { ReactNode } from 'react';
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