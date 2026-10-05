import type { ReactNode } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

import DepartmentSidebar from "@/app/department/[department]/Sidebar";
import TopHeader from "@/app/department/[department]/TopHeader";
import Footer from "@/app/department/[department]/components/Footer";
import DataPrivacyModal from "@/app/department/[department]/components/DataPrivacyModal";

interface ClearSessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  organizationId?: string | null;
  department?: string | null;
  allowedTabs?: string[] | null;
}

export default async function ProtectedDepartmentLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ department: string }>;
}) {
  const { department } = await params;

  const cleanDepartment = decodeURIComponent(department)
    .trim()
    .toLowerCase();

  const session = await auth();

  // Not logged in
  if (!session?.user) {
    redirect(`/department/${encodeURIComponent(cleanDepartment)}?login=true`);
  }

  const user = session.user as ClearSessionUser;

  const role = (user.role || "").trim().toLowerCase();

  const allowedRoles = [
    "admin",
    "administrator",
    "master",
    "auditor",
    "audit",
    "superadmin",
  ];

  if (!allowedRoles.includes(role)) {
    redirect(
      `/department/${encodeURIComponent(cleanDepartment)}?forbidden=true`
    );
  }

  const organization = await prisma.organization.findUnique({
    where: {
      subdomain: cleanDepartment,
    },
  });

  if (!organization) {
    redirect("/");
  }

  // SuperAdmin and Master can access all departments
  const isGlobalAdmin =
    role === "superadmin" ||
    role === "master";

  if (
    !isGlobalAdmin &&
    user.organizationId !== organization.id
  ) {
    redirect(
      `/department/${encodeURIComponent(cleanDepartment)}?forbidden=true`
    );
  }

  const allowedTabs = Array.isArray(user.allowedTabs)
    ? user.allowedTabs
    : [];

  const currentUser = {
    id: user.id || "",
    fullName: user.name || "Department Officer",
    role: user.role || "OFFICER",
    email: user.email || "",
    organizationId: user.organizationId || "",
    department: user.department || cleanDepartment,
    allowedTabs,
  };

  return (
    <div className="clear-app-shell">

      {/* STATIC SIDEBAR */}
      <aside className="clear-sidebar">
        <DepartmentSidebar
          department={cleanDepartment}
          currentUser={currentUser}
        />
      </aside>

      {/* RIGHT SIDE APPLICATION */}
      <div className="clear-main-area">

        {/* STATIC HEADER */}
        <header className="clear-header">
          <TopHeader
            department={cleanDepartment}
            currentUser={currentUser}
          />
        </header>

        {/* ONLY THIS AREA CHANGES */}
        <main className="clear-page-content">
          {children}
        </main>

        {/* STATIC FOOTER */}
        <footer className="clear-footer">
          <Footer />
        </footer>

      </div>

      <DataPrivacyModal />
    </div>
  );
}