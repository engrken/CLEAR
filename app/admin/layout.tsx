import AdminOtpModal from './components/AdminOtpModal';
import '@/app/globals.css';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-bs-theme="dark">
      <head>
        <link 
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" 
          rel="stylesheet" 
        />
        <link 
          rel="stylesheet" 
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" 
        />
      </head>
      <body className="bg-body text-body min-vh-100 d-flex flex-column">
        
        {/* Main View Area */}
        <main className="flex-grow-1 d-flex flex-column justify-content-center align-items-center p-3">
          {children}
        </main>

        {/* Global Admin OTP Modal Mount */}
        <AdminOtpModal />

        {/* REQUIRED: Bootstrap JS for Modal triggers */}
        <script 
          src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" 
          async 
        />
      </body>
    </html>
  );
}