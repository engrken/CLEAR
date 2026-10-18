// /app/dashboard/components/LogoutButton.tsx
'use client';

import { logoutEntityAdminAction } from '@/app/dashboard/entity/actions';

// Submit the server action as a form so Next.js can handle its redirect naturally.
// This ends the entity-admin cookie and the NextAuth session.
export default function LogoutButton() {
  return (
    <form action={logoutEntityAdminAction} className="d-inline">
      <button type="submit" className="btn btn-sm btn-outline-danger fw-bold ms-3">
        <i className="bi bi-box-arrow-right me-1" />Lock System
      </button>
    </form>
  );
}
