import { headers } from 'next/headers';

export default async function DepartmentLoading() {
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3000';
  
  // Extract port and check if running on local subdomain
  const port = host.includes(':') ? host.split(':')[1] : '3000';
  const isLocalhostSubdomain = host.includes('.localhost');
  
  // Match the exact asset resolution used in TopHeader & Sidebar
  const fcuLogoPath = isLocalhostSubdomain 
    ? `http://localhost:${port}/fcu.png` 
    : '/fcu.png';

  return (
    <div 
      id="loadingOverlay" 
      className="d-flex flex-column align-items-center justify-content-center w-100 my-auto"
      style={{ minHeight: '60vh', height: '100%' }}
    >
      <div className="text-center p-5">
        <img 
          src={fcuLogoPath} 
          alt="Loading System Data..." 
          style={{ width: '90px', height: '90px', objectFit: 'contain', marginBottom: '1.25rem' }} 
        />
        <div className="text-secondary small fw-bold text-uppercase" style={{ letterSpacing: '0.1em' }}>
          Loading System Data...
        </div>
      </div>
    </div>
  );
}