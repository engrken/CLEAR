import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function ProtectedSubRoutesLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ department: string }>;
}) {
  const session = await auth();
  const { department } = await params;

  // If a user tries to access a sub-tab (like /clearance) without being logged in,
  // instantly redirect them to the root department page to see the Login Modal.
  if (!session?.user) {
    redirect(`/department/${department}?login=true`);
  }

  // If logged in, just render the page normally!
  return <>{children}</>;
}