// /[department]/layout.tsx
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import DepartmentSidebar from "@/app/department/[department]/Sidebar"; // Make sure this path exactly matches your file structure
import TopHeader from "@/app/department/[department]/TopHeader";
import Footer from "@/app/department/[department]/components/Footer";
import DataPrivacyModal from "@/app/department/[department]/components/DataPrivacyModal";

interface ProtectedDepartmentLayoutProps {
  children: ReactNode;
  params: Promise<{ department: string }>;
}

// 1. Define the custom user type for NextAuth to satisfy TypeScript
interface ExtendedUser {
  id?: string;
  name?: string | null;
  email?: string | null;
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

  // ---------------------------------------------------------
  // INVALID DEPARTMENT CHECK
  // ---------------------------------------------------------
  if (!cleanDepartment) {
    return (
      <div className="d-flex min-vh-100 align-items-center justify-content-center">
         <h2>Invalid Department</h2>
      </div>
    );
  }

  // ---------------------------------------------------------
  // AUTHENTICATION STATE
  // ---------------------------------------------------------
  const session = await auth();

  // If unauthenticated, DO NOT redirect (prevents infinite loops).
  // Return raw children so page.tsx can render the OtpModal/Login UI.
  if (!session?.user) {
    return <>{children}</>;
  }

  // ---------------------------------------------------------
  // USER INFORMATION FROM NEXTAUTH (WITH TYPESCRIPT FIX)
  // ---------------------------------------------------------
  // 2. Cast session.user to ExtendedUser
  const authUser = session.user as ExtendedUser;

  const userRole = authUser.role?.trim().toLowerCase() || "officer";

  const allowedTabs = Array.isArray(authUser.allowedTabs)
    ? authUser.allowedTabs
    : [];

  const currentUser = {
    id: authUser.id || "",
    fullName: authUser.name || "Department Officer",
    role: authUser.role || "OFFICER",
    email: authUser.email || "",
    organizationId: authUser.organizationId || "",
    department: authUser.department || cleanDepartment,
    allowedTabs,
  };

  // ---------------------------------------------------------
  // ORGANIZATION / DEPARTMENT CHECK
  // ---------------------------------------------------------
  const organization = await prisma.organization.findUnique({
    where: {
      subdomain: cleanDepartment,
    },
    // ADDED: Make sure we fetch the logo and name so the sidebar can use them
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

  // ---------------------------------------------------------
  // AUTHORIZATION & TENANT ISOLATION
  // ---------------------------------------------------------
  // Note: "officer" was added to prevent default department officers from being locked out.
  const allowedRoles = new Set([
    "admin",
    "administrator",
    "master",
    "auditor",
    "audit",
    "superadmin",
    "officer" 
  ]);

  const isGlobalAdmin = userRole === "superadmin" || userRole === "master";
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

  // ---------------------------------------------------------
  // PROTECTED APPLICATION SHELL
  // ---------------------------------------------------------
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
        orgName={organization.name} // NEW: Pass the name to the sidebar
        logoUrl={organization.logo} // NEW: Pass the blob URL to the sidebar
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