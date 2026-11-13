// /app/department/[department]/components/Footer.tsx

'use client';

export default function Footer() {
  const handleOpenPrivacy = (e: React.MouseEvent) => {
    e.preventDefault();
    const modalEl = document.getElementById("dataPrivacyModal");
    if (modalEl && typeof window !== 'undefined' && (window as any).bootstrap) {
      const modal = (window as any).bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();
    }
  };

  // Build metadata is embedded at compile time, so each deployed revision
  // displays its own version without a database request or client-side fetch.
  const appVersion = process.env.NEXT_PUBLIC_CLEAR_APP_VERSION ?? '0.1.0';
  const buildSha = (process.env.NEXT_PUBLIC_CLEAR_BUILD_SHA ?? 'local').slice(0, 7);

  return (
    <footer className="app-footer py-3 text-center border-top border-secondary mt-auto">
      <div className="text-light small fw-semibold">
        &copy; 2026 <b>C</b>entralized <b>L</b>iquidation of <b>E</b>xpenses & <b>A</b>udit <b>R</b>ecords   |  v{appVersion}+{buildSha}
      </div>
      <div className="text-accent small" style={{ fontSize: '0.75rem' }}>
        All rights reserved • Designed & Developed by <a href="https://www.facebook.com/engrkenmark" target="_blank" rel="noopener noreferrer" className="text-info text-decoration-none">Engr. Bulquerin</a>
        • <a href="#privacy" onClick={handleOpenPrivacy} className="text-secondary text-decoration-underline ms-1" style={{ cursor: 'pointer' }}>Privacy Notice</a>
      </div>
    </footer>
  );
}