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

  return (
    <footer className="app-footer py-3 text-center border-top border-secondary mt-auto">
      <div className="text-light small fw-semibold">
        &copy; 2026 Filamer Christian University, Inc. – <b>C</b>entralized <b>L</b>iquidation of <b>E</b>xpenses & <b>A</b>udit <b>R</b>ecords   |  v1.5.2-beta.4
      </div>
      <div className="text-accent small" style={{ fontSize: '0.75rem' }}>
        All rights reserved • Designed & Developed by <a href="https://www.facebook.com/engrkenmark" target="_blank" rel="noopener noreferrer" className="text-info text-decoration-none">Engr. Bulquerin</a>
        • <a href="#privacy" onClick={handleOpenPrivacy} className="text-secondary text-decoration-underline ms-1" style={{ cursor: 'pointer' }}>Privacy Notice</a>
      </div>
    </footer>
  );
}