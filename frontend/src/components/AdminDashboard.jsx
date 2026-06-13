import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const AdminDashboard = () => {
  const { apiFetch, user: currentAdmin } = useAuth();
  
  // Tabs: 'payroll' or 'users'
  const [activeTab, setActiveTab] = useState('payroll');
  
  // Data States
  const [users, setUsers] = useState([]);
  const [payrollSummary, setPayrollSummary] = useState([]);
  const [pendingShifts, setPendingShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Add User Form State
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('employee');
  const [newRate, setNewRate] = useState('20.00');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Load Admin Data
  const loadPayrollData = useCallback(async () => {
    try {
      const response = await apiFetch('/admin/payroll');
      if (response.ok) {
        const data = await response.json();
        setPayrollSummary(data.summary);
        setPendingShifts(data.pendingShifts);
      }
    } catch (err) {
      console.error('Error loading payroll data:', err);
    }
  }, [apiFetch]);

  const loadUsersData = useCallback(async () => {
    try {
      const response = await apiFetch('/admin/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Error loading users:', err);
    }
  }, [apiFetch]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadPayrollData(), loadUsersData()]);
    setLoading(false);
  }, [loadPayrollData, loadUsersData]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Add User Handler
  const handleAddUser = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    
    if (!newUsername || !newPassword || !newRole || !newRate) {
      setFormError('All fields are required');
      return;
    }

    setFormSubmitting(true);
    try {
      const response = await apiFetch('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          role: newRole,
          hourly_rate: parseFloat(newRate)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create user');
      }

      setFormSuccess('User added successfully!');
      setNewUsername('');
      setNewPassword('');
      setNewRole('employee');
      setNewRate('20.00');
      
      // Reload lists
      await loadAllData();
    } catch (err) {
      setFormError(err.message || 'Error creating user');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete User Handler
  const handleDeleteUser = async (userId, username) => {
    if (userId === currentAdmin.user_id) {
      alert('You cannot delete your own admin account.');
      return;
    }

    if (!window.confirm(`Are you sure you want to completely remove "${username}"? All their logged hours will be permanently deleted.`)) {
      return;
    }

    try {
      const response = await apiFetch(`/admin/users/${userId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete user');
      }

      // Reload lists
      await loadAllData();
    } catch (err) {
      alert(err.message || 'Error deleting user');
    }
  };

  // Reconcile/Mark Shift as Paid
  const handleMarkPaid = async (logId) => {
    try {
      const response = await apiFetch(`/admin/shifts/${logId}/pay`, {
        method: 'PATCH',
        body: JSON.stringify({ payment_status: 'paid' })
      });

      if (response.ok) {
        // Reload payroll info instantly
        await loadPayrollData();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to update shift');
      }
    } catch (err) {
      console.error('Error updating shift status:', err);
    }
  };

  // Format Helper
  const formatDate = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Total Outstanding Calculations
  const totalOutstandingPayout = payrollSummary.reduce((acc, row) => acc + row.pending_payout, 0);
  const totalOutstandingHours = payrollSummary.reduce((acc, row) => acc + row.pending_hours, 0);

  return (
    <div className="admin-container animate-slide-up">
      <div className="admin-header glass-panel">
        <div className="header-info">
          <span className="welcome-label">Management Portal</span>
          <h1>Admin Command Board</h1>
          <p>Register employees, monitor clock statuses, track pending payouts, and reconcile shifts.</p>
        </div>
        <div className="tab-navigation">
          <button
            className={`tab-btn ${activeTab === 'payroll' ? 'active' : ''}`}
            onClick={() => setActiveTab('payroll')}
          >
            Payroll & Reconciliation
          </button>
          <button
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            User Roster Manager
          </button>
        </div>
      </div>

      {loading ? (
        <div className="admin-loading">
          <div className="spinner"></div>
          <p>Loading database rosters...</p>
        </div>
      ) : (
        <>
          {activeTab === 'payroll' ? (
            <div className="admin-content-grid">
              {/* Stat summary cards */}
              <div className="stats-grid grid-cols-2" style={{ gridColumn: '1 / -1', marginBottom: '1.5rem' }}>
                <div className="stat-card glass-card pending-theme">
                  <div className="stat-icon-container">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
                      <line x1="12" y1="18" x2="12" y2="18.01" />
                      <line x1="12" y1="6" x2="12" y2="14" />
                    </svg>
                  </div>
                  <div className="stat-data">
                    <span className="stat-label">Total Company Pending Payroll</span>
                    <h3 className="stat-value">${totalOutstandingPayout.toFixed(2)}</h3>
                    <span className="stat-sub">{totalOutstandingHours.toFixed(2)} hours pending review</span>
                  </div>
                </div>

                <div className="stat-card glass-card total-theme">
                  <div className="stat-icon-container">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <div className="stat-data">
                    <span className="stat-label">Active Roster Size</span>
                    <h3 className="stat-value">{payrollSummary.length} Employees</h3>
                    <span className="stat-sub">Excluding administrators</span>
                  </div>
                </div>
              </div>

              {/* 1. Payment Reconciliation: Unreconciled Shifts */}
              <div className="dashboard-content glass-card" style={{ gridColumn: '1 / -1', marginBottom: '1.5rem' }}>
                <div className="content-header">
                  <h3>Unpaid completed shifts ({pendingShifts.length})</h3>
                  <p className="subheader-desc">Review completed time cards and mark them as Paid to update historical balances.</p>
                </div>
                
                {pendingShifts.length === 0 ? (
                  <div className="content-empty">
                    <p>All completed shifts have been fully reconciled and paid! 🎉</p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Clocked In</th>
                          <th>Clocked Out</th>
                          <th>Hours</th>
                          <th>Rate</th>
                          <th>Payout</th>
                          <th>Reconciliation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingShifts.map((shift) => {
                          const hours = Number(shift.total_hours || 0);
                          const rate = Number(shift.hourly_rate || 0);
                          const payout = hours * rate;
                          
                          return (
                            <tr key={shift.log_id}>
                              <td style={{ fontWeight: '600' }}>{shift.username}</td>
                              <td>{formatDate(shift.clock_in)}</td>
                              <td>{formatDate(shift.clock_out)}</td>
                              <td>{hours.toFixed(2)} hrs</td>
                              <td>${rate.toFixed(2)}/hr</td>
                              <td style={{ fontWeight: '600', color: 'var(--success)' }}>
                                ${payout.toFixed(2)}
                              </td>
                              <td>
                                <button
                                  className="btn btn-success btn-sm"
                                  onClick={() => handleMarkPaid(shift.log_id)}
                                >
                                  Mark Paid
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 2. Payroll Overview: Employees Payout List */}
              <div className="dashboard-content glass-card" style={{ gridColumn: '1 / -1' }}>
                <div className="content-header">
                  <h3>Employee Payroll Balances</h3>
                  <p className="subheader-desc">Sum of all outstanding and compensated earnings by employee profile.</p>
                </div>

                {payrollSummary.length === 0 ? (
                  <div className="content-empty">
                    <p>No employees registered. Go to "User Roster Manager" to add users.</p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Hourly Rate</th>
                          <th>Pending Hours</th>
                          <th>Outstanding Payout</th>
                          <th>Reconciled Hours</th>
                          <th>Paid Earnings</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payrollSummary.map((emp) => (
                          <tr key={emp.user_id}>
                            <td style={{ fontWeight: '600' }}>{emp.username}</td>
                            <td>${emp.hourly_rate.toFixed(2)}/hr</td>
                            <td>{emp.pending_hours.toFixed(2)} hrs</td>
                            <td style={{ fontWeight: '600', color: emp.pending_payout > 0 ? 'var(--warning)' : 'inherit' }}>
                              ${emp.pending_payout.toFixed(2)}
                            </td>
                            <td>{emp.paid_hours.toFixed(2)} hrs</td>
                            <td style={{ fontWeight: '600', color: 'var(--success)' }}>
                              ${emp.paid_payout.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Tab 2: User Roster Manager
            <div className="admin-users-grid">
              {/* Form to Add User */}
              <div className="glass-card user-form-panel">
                <div className="content-header">
                  <h3>Register New Account</h3>
                  <p className="subheader-desc">Create employee credentials or add a fellow administrator.</p>
                </div>

                <form onSubmit={handleAddUser}>
                  {formError && <div className="login-error">{formError}</div>}
                  {formSuccess && <div className="form-success">{formSuccess}</div>}

                  <div className="form-group">
                    <label htmlFor="new-username">Username</label>
                    <input
                      type="text"
                      id="new-username"
                      placeholder="e.g. bob_builder"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      disabled={formSubmitting}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="new-password">Unique Password / PIN</label>
                    <input
                      type="password"
                      id="new-password"
                      placeholder="e.g. bobPIN789"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={formSubmitting}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="new-role">Roster Role</label>
                    <select
                      id="new-role"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      disabled={formSubmitting}
                    >
                      <option value="employee">Employee (Kiosk Visible)</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="new-rate">Hourly Rate ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.00"
                      id="new-rate"
                      placeholder="e.g. 25.00"
                      value={newRate}
                      onChange={(e) => setNewRate(e.target.value)}
                      disabled={formSubmitting || newRole === 'admin'}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-block"
                    disabled={formSubmitting || !newUsername || !newPassword}
                  >
                    {formSubmitting ? 'Registering...' : 'Register User'}
                  </button>
                </form>
              </div>

              {/* Roster List */}
              <div className="glass-card user-list-panel">
                <div className="content-header">
                  <h3>Active Accounts Roster ({users.length})</h3>
                  <p className="subheader-desc">Full index of registered profiles and system configuration permissions.</p>
                </div>

                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Role</th>
                        <th>Hourly Rate</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => {
                        const isSelf = u.user_id === currentAdmin.user_id;
                        
                        return (
                          <tr key={u.user_id}>
                            <td style={{ fontWeight: '600' }}>{u.username}</td>
                            <td>
                              <span className={`badge ${u.role === 'admin' ? 'badge-warning' : 'badge-success'}`}>
                                <span className="badge-dot"></span>
                                {u.role}
                              </span>
                            </td>
                            <td>
                              {u.role === 'admin' ? 'N/A' : `$${u.hourly_rate.toFixed(2)}/hr`}
                            </td>
                            <td>
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={isSelf}
                                onClick={() => handleDeleteUser(u.user_id, u.username)}
                                title={isSelf ? 'Cannot delete yourself' : 'Remove account'}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
