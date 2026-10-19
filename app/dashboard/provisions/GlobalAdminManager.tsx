import { updateGlobalAdminStatus, renewGlobalAdminInvitation } from './super-admin-actions';
import GlobalAdminInviteForm from './GlobalAdminInviteForm';

type Account = {
  id: string; email: string; fullName: string; status: string; invitedBy: string;
  invitationExpiresAt: Date; lastLoginAt: Date | null; activatedAt: Date | null;
  createdAt: Date;
};
type Audit = { id: string; actorEmail: string; targetEmail: string; action: string; createdAt: Date };
export function GlobalAdminManager({ accounts, audit, actorEmail }: {
  accounts: Account[]; audit: Audit[]; actorEmail: string;
}) {
  return <section className="card bg-dark border-info border-opacity-50 p-4 mt-4" aria-label="Global Super Admin accounts">
    <h2 className="h5 text-info mb-2">Global Super Admin Accounts</h2>
    <p className="small text-secondary">
      The original SUPER_ADMIN_EMAIL remains the protected bootstrap administrator.
      Each additional administrator has an independent verified email, audit identity and revocable access.
    </p>
    <div className="small border border-secondary rounded p-3 mb-3">
      <strong>Bootstrap administrator:</strong> {process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() || 'Not configured'}
      <span className="badge bg-info text-dark ms-2">Protected</span>
    </div>
    <GlobalAdminInviteForm />
    <p className="small text-secondary">
      Invitation expires after 7 days. The invited administrator activates their account by
      opening the main dashboard, choosing System SuperAdmin Access and completing their first email OTP.
      No access is granted before the OTP is verified.
    </p>
    <div className="table-responsive">
      <table className="table table-dark table-hover align-middle">
        <thead><tr><th>Administrator</th><th>Status</th><th>Last sign-in</th><th>Actions</th></tr></thead>
        <tbody>{accounts.map(account => <tr key={account.id}>
          <td><strong>{account.fullName}</strong><div className="small text-secondary">{account.email}</div>
            <div className="small text-muted">Invited by {account.invitedBy}</div></td>
          <td><span className="badge bg-secondary">{account.status}</span>
            {account.status === 'Pending' && <div className="small text-muted">Expires {account.invitationExpiresAt.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} PHT</div>}</td>
          <td className="small">{account.lastLoginAt
            ? account.lastLoginAt.toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) + ' PHT' : 'Not yet signed in'}</td>
          <td>
            {account.email !== actorEmail && account.status !== 'Revoked' && <div className="d-flex gap-2 flex-wrap">
              {['Active','Pending'].includes(account.status) && <form action={updateGlobalAdminStatus}>
                <input type="hidden" name="id" value={account.id}/><input type="hidden" name="command" value="disable"/>
                <button className="btn btn-outline-warning btn-sm" type="submit">Disable</button></form>}
              {account.status === 'Pending' && <form action={renewGlobalAdminInvitation}>
                <input type="hidden" name="id" value={account.id}/>
                <button className="btn btn-outline-info btn-sm" type="submit">Renew invitation</button></form>}
              {account.status === 'Disabled' && <form action={updateGlobalAdminStatus}>
                <input type="hidden" name="id" value={account.id}/><input type="hidden" name="command" value="enable"/>
                <button className="btn btn-outline-success btn-sm" type="submit">Enable</button></form>}
              <details className="small"><summary className="text-danger" role="button">Revoke account…</summary>
                <p className="small text-warning mb-1 mt-2">This permanently disables access and expires existing sessions.</p>
                <form action={updateGlobalAdminStatus}>
                  <input type="hidden" name="id" value={account.id}/>
                  <input type="hidden" name="command" value="revoke"/>
                  <button className="btn btn-danger btn-sm" type="submit">Confirm permanent revocation</button>
                </form>
              </details>
            </div>}
          </td>
        </tr>)}
        {!accounts.length && <tr><td colSpan={4} className="text-center text-secondary">No additional global administrators yet.</td></tr>}
        </tbody>
      </table>
    </div>
    <h3 className="h6 text-info mt-3">Recent Super Admin Security Audit</h3>
    <div className="table-responsive"><table className="table table-sm table-dark">
      <thead><tr><th>Time (PHT)</th><th>Action</th><th>Actor</th><th>Target</th></tr></thead>
      <tbody>{audit.map(event => <tr key={event.id}>
        <td>{event.createdAt.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</td>
        <td>{event.action}</td><td>{event.actorEmail}</td><td>{event.targetEmail}</td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}
