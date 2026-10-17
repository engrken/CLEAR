export default async function DepartmentLoading() {
  // Always use a clean root-relative absolute path for Vercel & production
  const clearsysLogoPath = '/clearsys.png';

  return (
    <div 
      id="loadingOverlay" 
      className="d-flex flex-column align-items-center justify-content-center w-100 my-auto"
      style={{ minHeight: '60vh', height: '100%' }}
    >
      <div className="text-center p-5">
        <img 
          src={clearsysLogoPath} 
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