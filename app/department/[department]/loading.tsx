export default function DepartmentLoading() {
  return (
    <div 
      className="d-flex flex-column align-items-center justify-content-center w-100 my-auto"
      style={{ minHeight: '60vh', height: '100%' }}
    >
      {/* Inline CSS for the pulsing animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes logoPulse {
          0% { transform: scale(0.95); opacity: 0.7; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.7; }
        }
        .animated-logo {
          animation: logoPulse 1.5s infinite ease-in-out;
        }
      `}} />

      <div className="text-center p-5">
        <img 
          src="/fcu.png" 
          alt="Loading System Data..." 
          className="animated-logo"
          style={{ width: '90px', height: '90px', objectFit: 'contain', marginBottom: '1.25rem' }} 
        />
        <div className="text-secondary small fw-bold text-uppercase placeholder-glow" style={{ letterSpacing: '0.1em' }}>
          <span className="placeholder bg-secondary rounded px-2">Loading System Data...</span>
        </div>
      </div>
    </div>
  );
}