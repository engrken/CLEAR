// /app/department/[department]/(protected)/users/UserManagementClient.tsx

"use client";
import { clearAlert, clearConfirm, clearPrompt } from "@/lib/clear-dialogs";


import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveTenantUser,
  deleteTenantUser,
  updateUserAccountStatus,
} from "./actions";
import { ThemedAlert } from "@/lib/clear-dialogs";
import { PRESET_ROLE_TABS } from "@/lib/role-permissions";

interface TenantUser {
  id: string;
  userId: string;
  name: string;
  email: string;
  username?: string;
  role: string;
  status: string;
  otpAttempts?: number;
  allowedTabs?: string[];
  isSuperAdmin: boolean;
}

const CLEAR_SYSTEM_TABS = [
  { id: 'tab-overview', label: 'Overview' },
  { id: 'tab-students', label: 'Students Roster' },
  { id: 'tab-clearance', label: 'Clearance' },
  { id: 'tab-payment', label: 'Collections' },
  { id: 'tab-remittances', label: 'Remittance Queue' },
  { id: 'tab-penalties', label: 'Penalties' },
  { id: 'tab-advances', label: 'Cash Advances' },
  { id: 'tab-audit', label: 'Liquidations' },
  { id: 'tab-collectibles', label: 'Collectibles' },
  { id: 'tab-reports', label: 'Detailed Reports' },
  { id: 'tab-void', label: 'Void Center' },
  { id: 'tab-report', label: 'Summary Report' },
  { id: 'tab-transfer', label: 'Realign Funds' },
  { id: 'tab-users', label: 'User Management' },
  { id: 'tab-setup', label: 'System Setup' }
];

export default function UserManagementClient({
  initialUsers,
  department,
  currentUserId,
  currentUserEmail,
}: {
  initialUsers: TenantUser[];
  department: string;
  currentUserId: string;
  currentUserEmail: string;
}) {
  const router = useRouter();
  const [users, setUsers] = useState<TenantUser[]>(initialUsers);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("treasurer");
  const [status, setStatus] = useState("Active");
  const [selectedTabs, setSelectedTabs] = useState<string[]>(PRESET_ROLE_TABS.treasurer);

  const safeDepartment = department.toUpperCase();
  const isCurrentAccount = (user: TenantUser) =>
    (Boolean(currentUserId) && user.id === currentUserId) ||
    (Boolean(currentUserEmail) && user.email.trim().toLowerCase() === currentUserEmail.trim().toLowerCase());

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    setSelectedTabs(PRESET_ROLE_TABS[newRole] || PRESET_ROLE_TABS.viewer);
  };

  const handleTabToggle = (tabId: string) => {
    setSelectedTabs(prev =>  
      prev.includes(tabId) ? prev.filter(t => t !== tabId) : [...prev, tabId]
    );
  };

  const handleResetToPreset = () => {
    setSelectedTabs(PRESET_ROLE_TABS[role] || PRESET_ROLE_TABS.viewer);
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFullName("");
    setEmail("");
    setUsername("");
    setRole("treasurer");
    setStatus("Active");
    setSelectedTabs(PRESET_ROLE_TABS.treasurer);
    setShowModal(true);
  };

  const openEditModal = (user: TenantUser) => {
    setEditingUser(user);
    setFullName(user.name);
    setEmail(user.email);
    setUsername(user.username || "");
    const normalizedRole = ['master', 'administrator', 'admin'].includes(user.role.toLowerCase()) ? 'admin' : user.role.toLowerCase();
    setRole(normalizedRole);
    setStatus(user.status);
    setSelectedTabs(user.allowedTabs && user.allowedTabs.length > 0 ? user.allowedTabs : (PRESET_ROLE_TABS[normalizedRole] || PRESET_ROLE_TABS.viewer));
    setShowModal(true);
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (users.some(u => u.id === userId && isCurrentAccount(u))) {
      void clearAlert("You cannot delete your currently signed-in account.");
      return;
    }
    if (!await clearConfirm(`Are you sure you want to revoke access and delete account for "${userName}"?`)) {
      return;
    }

    try {
      const res = await deleteTenantUser(userId, department);
      if (res.success) {
        setUsers(prev => prev.filter(u => u.id !== userId));
        void clearAlert(res.message);
        router.refresh();
      }
    } catch (err: any) {
      void clearAlert(err.message || "Failed to delete user account.");
    }
  };

  const handleStatusChangeAction = async (userId: string, newStatus: 'Active' | 'Inactive' | 'Blocked') => {
    if (newStatus !== 'Active' && users.some(u => u.id === userId && isCurrentAccount(u))) {
      void clearAlert("You cannot deactivate or block your currently signed-in account.");
      return;
    }
    try {
      const res = await updateUserAccountStatus(userId, newStatus, department);
      if (res.success) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus, otpAttempts: newStatus === 'Active' ? 0 : u.otpAttempts } : u));
        void clearAlert(res.message);
        router.refresh();
      }
    } catch (err: any) {
      void clearAlert(err.message || "Failed to update account status.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        id: editingUser ? editingUser.id : null,
        userId: editingUser ? editingUser.userId : undefined,
        fullName,
        email,
        username,
        role,
        status,
        allowedTabs: selectedTabs,
        department
      };

      const res = await saveTenantUser(payload);
      if (res.success) {
        void clearAlert(res.message);
        setShowModal(false);
        router.refresh();
      }
    } catch (err: any) {
      void clearAlert(err.message || "Failed to save user account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadgeClass = (r: string) => {
    const lower = r.toLowerCase();
    if (lower.includes('admin') || lower.includes('master')) return 'bg-danger text-white';
    if (lower.includes('treasurer')) return 'bg-success text-white';
    if (lower.includes('auditor')) return 'bg-info text-dark';
    return 'bg-secondary text-white';
  };

  return (
    <div className="card p-3 p-md-4 border-secondary shadow-sm bg-card text-color">
      {/* Header Toolbar */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h5 className="text-accent mb-1 fw-bold">
            <i className="bi bi-people-fill me-2"></i>Officer Accounts & Access Permissions
          </h5>
          <p className="text-secondary small mb-0">
            Manage administrative accounts, role assignments, and individual module permissions for {safeDepartment}.
          </p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => window.location.reload()}>
            <i className="bi bi-arrow-repeat me-1"></i>Refresh
          </button>
          <button className="btn btn-primary btn-sm fw-bold px-3" onClick={openCreateModal}>
            <i className="bi bi-person-plus-fill me-1"></i>Add New User
          </button>
        </div>
      </div>

      {/* Authorized Users Ledger Table */}
      <div className="card border-secondary shadow-sm bg-surface">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-color" style={{ fontSize: '0.9rem' }}>
              <thead>
                <tr className="text-secondary small">
                  <th>User Details</th>
                  <th>Role</th>
                  <th>Scope</th>
                  <th className="text-center">Status / Lockout</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length > 0 ? (
                  users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="fw-bold">{u.name}</div>
                        <small className="text-secondary">{u.username ? `${u.username} • ` : ''}{u.email}</small>
                      </td>
                      <td>
                        <span className={`badge ${getRoleBadgeClass(u.role)} text-uppercase`} style={{ fontSize: '0.7rem' }}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <small className="text-secondary">
                          {u.allowedTabs ? `${u.allowedTabs.length} tabs accessible` : 'Default role scope'}
                        </small>
                      </td>
                      <td className="text-center">
                        {u.status === 'Active' && (
                          <span className="badge bg-success-subtle text-success border border-success px-2 py-1">
                            <i className="bi bi-check-circle-fill me-1"></i> Active
                          </span>
                        )}
                        {u.status === 'Inactive' && (
                          <span className="badge bg-secondary-subtle text-secondary border border-secondary px-2 py-1">
                            <i className="bi bi-dash-circle-fill me-1"></i> Inactive
                          </span>
                        )}
                        {u.status === 'Blocked' && (
                          <span className="badge bg-danger-subtle text-danger border border-danger px-2 py-1">
                            <i className="bi bi-shield-lock-fill me-1"></i> Blocked ({u.otpAttempts || 5}/5 tries)
                          </span>
                        )}
                      </td>
                      <td className="text-end">
                        <div className="d-flex gap-1 justify-content-end align-items-center">
                          {isCurrentAccount(u) ? (
                            <span className="badge bg-info-subtle text-info border border-info">Current Account</span>
                          ) : u.status === 'Blocked' ? (
                            <button 
                              className="btn btn-sm btn-warning fw-bold text-dark px-2"
                              onClick={() => handleStatusChangeAction(u.id, 'Active')}
                              title="Unblock account and reset failed OTP attempts"
                            >
                              <i className="bi bi-unlock-fill me-1"></i>Unblock
                            </button>
                          ) : (
                            <select
                              className="form-select form-select-sm bg-card text-color border-secondary"
                              style={{ width: '110px', fontSize: '0.8rem' }}
                              value={u.status}
                              onChange={(e) => handleStatusChangeAction(u.id, e.target.value as any)}
                            >
                              <option value="Active">Active</option>
                              <option value="Inactive">Inactive</option>
                              <option value="Blocked">Blocked</option>
                            </select>
                          )}
                          <button className="btn btn-sm btn-outline-info" onClick={() => openEditModal(u)}>
                            <i className="bi bi-pencil me-1"></i>Edit
                          </button>
                          {!u.isSuperAdmin && !isCurrentAccount(u) && (
                            <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteUser(u.id, u.name)}>
                              <i className="bi bi-trash me-1"></i>Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center text-secondary py-4">
                      No tenant users registered in the database yet. Click &quot;Add New User&quot; to configure the first account.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {showModal && (
        <div className="modal fade show d-block" tabIndex={1} style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content card border-secondary shadow bg-card text-color clear-theme-modal">
              <div className="modal-header border-secondary">
                <h5 className="modal-title text-accent">
                  <i className="bi bi-person-gear me-2"></i>{editingUser ? `Edit Account: ${editingUser.name}` : 'Add New Officer Account'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body p-4">
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label text-secondary small fw-semibold">Full Name <span className="text-danger">*</span></label>
                      <input 
                        type="text" 
                        className="form-control bg-card text-color border-secondary" 
                        value={fullName} 
                        onChange={(e) => setFullName(e.target.value)} 
                        placeholder="e.g., Alex Rivera" 
                        required 
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-secondary small fw-semibold">Institutional Email <span className="text-danger">*</span></label>
                      <input 
                        type="email" 
                        className="form-control bg-card text-color border-secondary" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        placeholder="officer@example.edu" 
                        required 
                      />
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-md-4">
                      <label className="form-label text-secondary small fw-semibold">Username <span className="text-danger">*</span></label>
                      <input 
                        type="text" 
                        className="form-control bg-card text-color border-secondary" 
                        value={username} 
                        onChange={(e) => setUsername(e.target.value)} 
                        placeholder="e.g., officer01" 
                        disabled={!!editingUser}
                        required 
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label text-secondary small fw-semibold">System Role</label>
                      <select 
                        className="form-select bg-card text-color border-secondary" 
                        value={role} 
                        onChange={(e) => handleRoleChange(e.target.value)}
                        required
                      >
                        <option value="treasurer">Department Treasurer</option>
                        <option value="auditor">Institutional Auditor</option>
                        <option value="admin">System Admin</option>
                        <option value="viewer">Viewer (Read-Only)</option>
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label text-secondary small fw-semibold">Status</label>
                      <select 
                        className="form-select bg-card text-color border-secondary" 
                        value={status} 
                        onChange={(e) => setStatus(e.target.value)}
                        disabled={!!editingUser && isCurrentAccount(editingUser)}
                        title={editingUser && isCurrentAccount(editingUser) ? "You cannot change your own account status" : undefined}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Blocked">Blocked</option>
                      </select>
                    </div>
                  </div>

                  {/* Module & Tab Access Permissions Matrix */}
                  <div className="border border-secondary rounded p-3 mt-3 bg-surface">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <label className="form-label text-secondary small fw-bold mb-0">Module & Tab Access Permissions</label>
                      <button 
                        type="button" 
                        className="btn btn-link btn-sm text-decoration-none p-0 text-info" 
                        onClick={handleResetToPreset}
                      >
                        Reset to Role Default
                      </button>
                    </div>
                    <p className="small text-secondary mb-3">Check or uncheck individual tabs to override default permissions for this account.</p>
                    <div className="row g-2">
                      {CLEAR_SYSTEM_TABS.map(tab => (
                        <div className="col-6 col-md-4" key={tab.id}>
                          <div className="form-check">
                            <input 
                              className="form-check-input border-secondary" 
                              type="checkbox" 
                              value={tab.id} 
                              id={`chk_${tab.id}`}
                              checked={selectedTabs.includes(tab.id)}
                              onChange={() => handleTabToggle(tab.id)}
                            />
                            <label className="form-check-label small text-color" htmlFor={`chk_${tab.id}`}>
                              {tab.label}
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-secondary">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-info btn-sm fw-bold px-4 text-dark" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save User Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}