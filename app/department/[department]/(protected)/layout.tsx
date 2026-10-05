import type { ReactNode } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import DepartmentSidebar from "@/app/department/[department]/Sidebar";
import TopHeader from "@/app/department/[department]/TopHeader";
import Footer from "@/app/department/[department]/components/Footer";
import DataPrivacyModal from "@/app/department/[department]/components/DataPrivacyModal";

interface ProtectedDepartmentLayoutProps {
  children: ReactNode;
  params: Promise<{ department: string }>;
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
  // USER INFORMATION FROM NEXTAUTH
  // ---------------------------------------------------------
  const userRole = session.user.role?.trim().toLowerCase() || "officer";

  const allowedTabs = Array.isArray(session.user.allowedTabs)
    ? session.user.allowedTabs
    : [];

  const currentUser = {
    id: session.user.id,
    fullName: session.user.name || "Department Officer",
    role: session.user.role || "OFFICER",
    email: session.user.email || "",
    organizationId: session.user.organizationId || "",
    department: session.user.department || cleanDepartment,
    allowedTabs,
  };

  // ---------------------------------------------------------
  // ORGANIZATION / DEPARTMENT CHECK
  // ---------------------------------------------------------
  const organization = await prisma.organization.findUnique({
    where: {
      subdomain: cleanDepartment,
    },
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
    if (!session.user.organizationId || session.user.organizationId !== organization.id) {
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
        currentUser={currentUser}
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