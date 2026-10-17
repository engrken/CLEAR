// /app/dashboard/entity/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EntityAdminLoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/entity-admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed.');

      router.push('/dashboard/entity/portal');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container d-flex justify-content-center align-items-center min-vh-100">
      <div className="card bg-dark text-white border-secondary p-4 shadow-lg" style={{ maxWidth: '400px', width: '100%' }}>
        <div className="text-center mb-4">
          <div className="bg-info bg-opacity-10 border border-info border-opacity-25 text-info rounded-circle d-inline-flex p-3 mb-2">
            <i className="bi bi-building-fill-gear fs-3"></i>
          </div>
          <h3 className="fw-bold">Entity Admin Portal</h3>
          <p className="text-secondary small">Log in to manage your institutional group and associated entity workspaces.</p>
        </div>

        {error && (
          <div className="alert alert-danger py-2 small text-center" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="vstack gap-3">
          <div>
            <label className="form-label small text-uppercase text-info fw-bold">Administrator Email</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@entity.edu.ph"
              className="form-control bg-dark text-white border-secondary"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="btn btn-info fw-bold py-2 text-dark mt-2"
          >
            {loading ? 'Authenticating...' : 'Access Entity Portal'}
          </button>
        </form>

        <div className="text-center mt-4">
          <a href="/dashboard" className="text-secondary small text-decoration-none">
            <i className="bi bi-arrow-left me-1"></i> Back to Main Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}