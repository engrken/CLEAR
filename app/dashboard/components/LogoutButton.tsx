// /app/dashboard/components/LogoutButton.tsx

'use client';

import { signOut } from 'next-auth/react';

export default function LogoutButton() {
  return (
    <button 
      onClick={() => signOut({ callbackUrl: '/dashboard' })} 
      className="btn btn-sm btn-outline-danger fw-bold ms-3"
    >
      <i className="bi bi-box-arrow-right me-1"></i> Lock System
    </button>
  );
}