"use client";

import { useActionState, useState } from 'react';
import { inviteGlobalAdmin, type GlobalAdminInviteState } from './super-admin-actions';

const initial: GlobalAdminInviteState = { status: 'idle', message: '' };

export default function GlobalAdminInviteForm() {
  const [state, formAction, pending] = useActionState(inviteGlobalAdmin, initial);
  const [promote, setPromote] = useState(false);

  return <div className="mb-4">
    <form action={formAction} className="row g-2 align-items-end">
      <div className="col-md-4">
        <label className="form-label small" htmlFor="global-admin-name">Full name</label>
        <input id="global-admin-name" name="fullName" type="text" minLength={2}
          maxLength={120} required className="form-control"
          placeholder="Administrator's name" disabled={pending} />
      </div>
      <div className="col-md-5">
        <label className="form-label small" htmlFor="global-admin-email">Email address</label>
        <input id="global-admin-email" name="email" type="email" maxLength={254}
          required className="form-control" placeholder="admin@institution.edu" disabled={pending} />
      </div>
      <div className="col-md-3">
        <button className="btn btn-info w-100 fw-semibold text-dark" disabled={pending} type="submit">
          {pending ? 'Checking…' : promote ? 'Invite for Promotion' : 'Invite Super Admin'}
        </button>
      </div>
      <div className="col-12 mt-3">
        <label className="form-check-label d-flex align-items-start gap-2">
          <input className="form-check-input mt-1" type="checkbox" name="promoteExistingTenant"
            checked={promote} onChange={e=>setPromote(e.target.checked)} disabled={pending} />
          <span>
            <strong>Promote existing tenant account</strong>
            <span className="d-block small text-secondary">
              Explicitly authorize promotion of a person already registered in a college, department or organization.
              Their tenant record and transaction history remain; old tenant OTPs and mobile sessions are invalidated.
              After this invitation, this email authenticates through the global Super Admin OTP only.
            </span>
          </span>
        </label>
      </div>
      {promote && <div className="col-12 small text-warning">
        If the user is currently the only active tenant administrator for a department,
        appoint another active departmental administrator before promoting them.
      </div>}
      {state.message && <div className="col-12">
        <p role={state.status==='error'?'alert':'status'} className={
          state.status==='success' ? 'text-success small mb-0' : 'text-warning small mb-0'
        }>{state.message}</p>
      </div>}
    </form>
  </div>;
}
