// /app/department/[department]/components/Footer.tsx

'use client';

import Link from 'next/link';
import packageJson from '@/package.json';

// SAGA-style committed release version; deployment build ID is provided by the server.

export default function Footer({ buildId = '' }: { buildId?: string }) {
  const handleOpenPrivacy = (e: React.MouseEvent) => {
    e.preventDefault();
    const modalEl = document.getElementById("dataPrivacyModal");
    if (modalEl && typeof window !== 'undefined' && (window as any).bootstrap) {
      const modal = (window as any).bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();
    }
  };

  return (
    <footer className="app-footer py-3 text-center border-top border-secondary mt-auto">
      <div className="text-light small fw-semibold">
        &copy; 2026 <b>C</b>entralized <b>L</b>iquidation of <b>E</b>xpenses & <b>A</b>udit <b>R</b>ecords   |  <Link href="/updates" className="text-light text-decoration-none" title="View CLEAR release notes">v{packageJson.version}{buildId ? ` · build ${buildId}` : ''}</Link>
      </div>
      <div className="text-accent small" style={{ fontSize: '0.75rem' }}>
        All rights reserved • Designed & Developed by <a href="https://www.facebook.com/engrkenmark" target="_blank" rel="noopener noreferrer" className="text-info text-decoration-none">Engr. Bulquerin</a>
        • <a href="#privacy" onClick={handleOpenPrivacy} className="text-secondary text-decoration-underline ms-1" style={{ cursor: 'pointer' }}>Privacy Notice</a>
      </div>
    </footer>
  );
}