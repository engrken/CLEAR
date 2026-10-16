// /app/department/[department]/layout.tsx
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import DepartmentSidebar from "@/app/department/[department]/Sidebar";
import TopHeader from "@/app/department/[department]/TopHeader";
import Footer from "@/app/department/[department]/components/Footer";
import { isSuperAdminEmail } from "@/lib/permissions";
import DataPrivacyModal from "@/app/department/[department]/components/DataPrivacyModal";

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
  organizationId?: string;
  department?: string;
  allowedTabs?: string[];
}

export default async function ProtectedDepartmentLayout({
  children,
  params,
}: ProtectedDepartmentLayoutProps) {
  const { department } = await params;

  const cleanDepartment = decodeURIComponent(department)
    .trim()
    .toLowerCase();

  if (!cleanDepartment) {
    return (
      <div className="d-flex min-vh-100 align-items-center justify-content-center">
         <h2>Invalid Department</h2>
      </div>
    );
  }

  const session = await auth();

  if (!session?.user) {
    return <>{children}</>;
  }

  const authUser = session.user as ExtendedUser;
  const userRole = authUser.role?.trim().toLowerCase() || "officer";

  const allowedTabs = Array.isArray(authUser.allowedTabs)
    ? authUser.allowedTabs
    : [];

  const currentUser = {
    id: authUser.id || "",
    fullName: authUser.name || "Department Officer",
    username: authUser.username || "N/A", // 🚀 Fixed F40: Added username property
    role: authUser.role || "OFFICER",
    email: authUser.email || "",
    organizationId: authUser.organizationId || "",
    department: authUser.department || cleanDepartment,
    allowedTabs,
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
      activeTerm: true
    }
  });

  if (!organization) {
    return (
      <div className="container-fluid p-4">
        <div className="alert alert-danger shadow-sm border-secondary">
          <h4 className="fw-bold mb-2">
            Department Not Found
          </h4>
          <p className="small mb-0">
            The department "{cleanDepartment}" does not exist
            in the database.
          </p>
        </div>
      </div>
    );
  }

  // 🚀 Fixed F34: Included treasurer, auditor, and viewer explicitly in allowedRoles
  const allowedRoles = new Set([
    "admin",
    "administrator",
    "master",
    "auditor",
    "audit",
    "treasurer",
    "viewer",
    "superadmin",
    "officer"
  ]);

  const isGlobalAdmin = isSuperAdminEmail(authUser.email);
  let isForbidden = false;
  let forbiddenReason = "";

  if (!allowedRoles.has(userRole)) {
    isForbidden = true;
    forbiddenReason = "Your role lacks permission to access the CLEAR system.";
  }

  if (!isGlobalAdmin && !isForbidden) {
    if (!authUser.organizationId || authUser.organizationId !== organization.id) {
      isForbidden = true;
      forbiddenReason = "You are not authorized to view records for this department.";
    }
  }

  return (
    <div
      className="d-flex min-vh-100"
      style={{
        width: "100%",
        minWidth: 0,
      }}
    >
      <DepartmentSidebar
        department={cleanDepartment}
        orgName={organization.name}
        logoUrl={organization.logo}
        currentUser={currentUser}
        defaultAy={organization.activeAy || undefined}
        defaultTerm={organization.activeTerm || undefined}
      />

      <div
        className="flex-grow-1 d-flex flex-column"
        style={{
          minWidth: 0,
          width: "100%",
        }}
      >
        <TopHeader
          department={cleanDepartment}
          currentUser={currentUser}
          defaultAy={organization.activeAy || undefined}
          defaultTerm={organization.activeTerm || undefined}
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
                <i className="bi bi-shield-lock-fill me-2"></i> Access Denied
              </h4>
              <p className="small mb-0">{forbiddenReason}</p>
            </div>
          ) : (
            children
          )}
        </main>

        <Footer />
        <DataPrivacyModal />
      </div>
    </div>
  );
}