import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

// Helper: format a JS Date or ISO string to 'YYYY-MM-DDTHH:MM' for datetime-local inputs
const toLocalInputValue = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Helper: calculate hours between two datetime strings
const calcHours = (clockIn, clockOut) => {
  if (!clockIn || !clockOut) return null;
  const diff = new Date(clockOut) - new Date(clockIn);
  if (diff <= 0) return null;
  return (diff / (1000 * 60 * 60)).toFixed(2);
};

const AdminDashboard = () => {
  const { apiFetch, user: currentAdmin } = useAuth();

  // Tabs: 'payroll' | 'manual' | 'users'
  const [activeTab, setActiveTab] = useState('payroll');

  // Data States
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
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

  // Manual Time Entry State
  const [manualUserId, setManualUserId] = useState('');
  const [manualClockIn, setManualClockIn] = useState('');
  const [manualClockOut, setManualClockOut] = useState('');
  const [manualError, setManualError] = useState('');
  const [manualSuccess, setManualSuccess] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // Edit Shift Modal State
  const [editingShift, setEditingShift] = useState(null);
  const [editClockIn, setEditClockIn] = useState('');
  const [editClockOut, setEditClockOut] = useState('');
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // All-Shifts list for edit panel
  const [allShifts, setAllShifts] = useState([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);

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
        setEmployees(data.filter(u => u.role === 'employee'));
      }
    } catch (err) {
      console.error('Error loading users:', err);
    }
  }, [apiFetch]);

  const loadAllShifts = useCallback(async () => {
    setShiftsLoading(true);
    try {
      const res = await apiFetch('/admin/payroll');
      if (res.ok) {
        const data = await res.json();
        setAllShifts(data.pendingShifts);
      }
    } catch (err) {
      console.error('Error loading all shifts:', err);
    } finally {
      setShiftsLoading(false);
    }
  }, [apiFetch]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadPayrollData(), loadUsersData()]);
    setLoading(false);
  }, [loadPayrollData, loadUsersData]);

  useEffect(() => { loadAllData(); }, [loadAllData]);

  useEffect(() => {
    if (activeTab === 'manual') loadAllShifts();
  }, [activeTab, loadAllShifts]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setFormError(''); setFormSuccess('');
    if (!newUsername || !newPassword || !newRole || !newRate) { setFormError('All fields are required'); return; }
    setFormSubmitting(true);
    try {
      const response = await apiFetch('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole, hourly_rate: parseFloat(newRate) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create user');
      setFormSuccess('User added successfully!');
      setNewUsername(''); setNewPassword(''); setNewRole('employee'); setNewRate('20.00');
      await loadAllData();
    } catch (err) {
      setFormError(err.message || 'Error creating user');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (userId === currentAdmin.user_id) { alert('You cannot delete your own admin account.'); return; }
    if (!window.confirm(`Remove "${username}"? All their logged hours will be permanently deleted.`)) return;
    try {
      const response = await apiFetch(`/admin/users/${userId}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to delete user');
      await loadAllData();
    } catch (err) {
      alert(err.message || 'Error deleting user');
    }
  };

  const handleMarkPaid = async (logId) => {
    try {
      const response = await apiFetch(`/admin/shifts/${logId}/pay`, {
        method: 'PATCH',
        body: JSON.stringify({ payment_status: 'paid' })
      });
      if (response.ok) {
        await loadPayrollData();
        await loadAllShifts();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to update shift');
      }
    } catch (err) {
      console.error('Error updating shift status:', err);
    }
  };

  const handleManualEntry = async (e) => {
    e.preventDefault();
    setManualError(''); setManualSuccess('');
    if (!manualUserId || !manualClockIn || !manualClockOut) { setManualError('Please fill in all fields.'); return; }
    const hrs = calcHours(manualClockIn, manualClockOut);
    if (!hrs) { setManualError('Clock-out must be after clock-in.'); return; }
    setManualSubmitting(true);
    try {
      const response = await apiFetch('/admin/logs', {
        method: 'POST',
        body: JSON.stringify({
          user_id: parseInt(manualUserId),
          clock_in: new Date(manualClockIn).toISOString(),
          clock_out: new Date(manualClockOut).toISOString()
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create entry');
      setManualSuccess(data.message);
      setManualUserId(''); setManualClockIn(''); setManualClockOut('');
      await loadAllData();
      await loadAllShifts();
    } catch (err) {
      setManualError(err.message || 'Error creating manual entry');
    } finally {
      setManualSubmitting(false);
    }
  };

  const openEditModal = (shift) => {
    setEditingShift(shift);
    setEditClockIn(toLocalInputValue(shift.clock_in));
    setEditClockOut(toLocalInputValue(shift.clock_out));
    setEditError('');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError('');
    const hrs = calcHours(editClockIn, editClockOut);
    if (!hrs) { setEditError('Clock-out must be after clock-in.'); return; }
    setEditSubmitting(true);
    try {
      const response = await apiFetch(`/admin/logs/${editingShift.log_id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          clock_in: new Date(editClockIn).toISOString(),
          clock_out: new Date(editClockOut).toISOString()
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to update log');
      setEditingShift(null);
      await loadAllData();
      await loadAllShifts();
    } catch (err) {
      setEditError(err.message || 'Error updating log');
    } finally {
      setEditSubmitting(false);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const totalOutstandingPayout = payrollSummary.reduce((acc, row) => acc + row.pending_payout, 0);
  const totalOutstandingHours = payrollSummary.reduce((acc, row) => acc + row.pending_hours, 0);
  const manualHrsPreview = calcHours(manualClockIn, manualClockOut);
  const editHrsPreview = calcHours(editClockIn, editClockOut);

  return (
    <div className="admin-container animate-slide-up">

      {/* ---- EDIT MODAL ---- */}
      {editingShift && (
        <div className="modal-backdrop animate-fade-in">
          <div className="modal-content glass-card animate-slide-up">
            <div className="modal-header">
              <div className="modal-icon-container">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </div>
              <h3>Edit Shift Timestamps</h3>
              <p className="modal-subtitle">Correcting logged hours for <strong>{editingShift.username}</strong></p>
            </div>
            <form onSubmit={handleEditSubmit}>
              {editError && <div className="login-error" style={{ marginBottom: '1rem' }}>{editError}</div>}
              <div className="form-group">
                <label>Clock-In Time</label>
                <input type="datetime-local" value={editClockIn} onChange={e => { setEditError(''); setEditClockIn(e.target.value); }} disabled={editSubmitting} required />
              </div>
              <div className="form-group">
                <label>Clock-Out Time</label>
                <input type="datetime-local" value={editClockOut} onChange={e => { setEditError(''); setEditClockOut(e.target.value); }} disabled={editSubmitting} required />
              </div>
              {editHrsPreview && (
                <div className="hours-preview">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Recalculated Total: <strong>{editHrsPreview} hrs</strong>
                </div>
              )}
              <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingShift(null)} disabled={editSubmitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editSubmitting || !editHrsPreview}>
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---- HEADER ---- */}
      <div className="admin-header glass-panel">
        <div className="header-info">
          <span className="welcome-label">Management Portal</span>
          <h1>Admin Command Board</h1>
          <p>Register employees, monitor payouts, and correct missed time entries.</p>
        </div>
        <div className="tab-navigation">
          <button className={`tab-btn ${activeTab === 'payroll' ? 'active' : ''}`} onClick={() => setActiveTab('payroll')}>Payroll & Reconciliation</button>
          <button className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`} onClick={() => setActiveTab('manual')}>✏️ Time Corrections</button>
          <button className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>User Roster Manager</button>
        </div>
      </div>

      {loading ? (
        <div className="admin-loading"><div className="spinner"></div><p>Loading database rosters...</p></div>
      ) : (
        <>
          {/* ---- TAB: PAYROLL ---- */}
          {activeTab === 'payroll' && (
            <div className="admin-content-grid">
              <div className="stats-grid grid-cols-2" style={{ gridColumn: '1 / -1', marginBottom: '1.5rem' }}>
                <div className="stat-card glass-card pending-theme">
                  <div className="stat-icon-container">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/><line x1="12" y1="6" x2="12" y2="14"/></svg>
                  </div>
                  <div className="stat-data">
                    <span className="stat-label">Total Company Pending Payroll</span>
                    <h3 className="stat-value">${totalOutstandingPayout.toFixed(2)}</h3>
                    <span className="stat-sub">{totalOutstandingHours.toFixed(2)} hours pending</span>
                  </div>
                </div>
                <div className="stat-card glass-card total-theme">
                  <div className="stat-icon-container">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </div>
                  <div className="stat-data">
                    <span className="stat-label">Active Roster Size</span>
                    <h3 className="stat-value">{payrollSummary.length} Employees</h3>
                    <span className="stat-sub">Excluding administrators</span>
                  </div>
                </div>
              </div>

              <div className="dashboard-content glass-card" style={{ gridColumn: '1 / -1', marginBottom: '1.5rem' }}>
                <div className="content-header">
                  <h3>Unpaid Completed Shifts ({pendingShifts.length})</h3>
                  <p className="subheader-desc">Mark shifts as paid or edit timestamps if they need correction.</p>
                </div>
                {pendingShifts.length === 0 ? (
                  <div className="content-empty"><p>All shifts fully reconciled! 🎉</p></div>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead><tr><th>Employee</th><th>Clocked In</th><th>Clocked Out</th><th>Hours</th><th>Payout</th><th>Actions</th></tr></thead>
                      <tbody>
                        {pendingShifts.map((shift) => {
                          const hours = Number(shift.total_hours || 0);
                          const payout = hours * Number(shift.hourly_rate || 0);
                          return (
                            <tr key={shift.log_id}>
                              <td style={{ fontWeight: '600' }}>{shift.username}</td>
                              <td>{formatDate(shift.clock_in)}</td>
                              <td>{formatDate(shift.clock_out)}</td>
                              <td>{hours.toFixed(2)} hrs</td>
                              <td style={{ fontWeight: '600', color: 'var(--success)' }}>${payout.toFixed(2)}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(shift)}>✏️ Edit</button>
                                  <button className="btn btn-success btn-sm" onClick={() => handleMarkPaid(shift.log_id)}>Mark Paid</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="dashboard-content glass-card" style={{ gridColumn: '1 / -1' }}>
                <div className="content-header">
                  <h3>Employee Payroll Balances</h3>
                </div>
                {payrollSummary.length === 0 ? (
                  <div className="content-empty"><p>No employees registered.</p></div>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead><tr><th>Employee</th><th>Rate</th><th>Pending Hrs</th><th>Outstanding</th><th>Paid Hrs</th><th>Paid Total</th></tr></thead>
                      <tbody>
                        {payrollSummary.map((emp) => (
                          <tr key={emp.user_id}>
                            <td style={{ fontWeight: '600' }}>{emp.username}</td>
                            <td>${emp.hourly_rate.toFixed(2)}/hr</td>
                            <td>{emp.pending_hours.toFixed(2)} hrs</td>
                            <td style={{ fontWeight: '600', color: emp.pending_payout > 0 ? 'var(--warning)' : 'inherit' }}>${emp.pending_payout.toFixed(2)}</td>
                            <td>{emp.paid_hours.toFixed(2)} hrs</td>
                            <td style={{ fontWeight: '600', color: 'var(--success)' }}>${emp.paid_payout.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---- TAB: TIME CORRECTIONS ---- */}
          {activeTab === 'manual' && (
            <div className="admin-users-grid">
              <div className="glass-card user-form-panel">
                <div className="content-header" style={{ marginBottom: '1.5rem' }}>
                  <div>
                    <h3>Add Manual Shift</h3>
                    <p className="subheader-desc" style={{ marginTop: '0.35rem' }}>
                      Employee forgot to clock in? Create a corrected shift entry with their exact start and end times.
                    </p>
                  </div>
                </div>
                <form onSubmit={handleManualEntry}>
                  {manualError && <div className="login-error">{manualError}</div>}
                  {manualSuccess && <div className="form-success">{manualSuccess}</div>}
                  <div className="form-group">
                    <label>Select Employee</label>
                    <select value={manualUserId} onChange={e => { setManualError(''); setManualUserId(e.target.value); }} disabled={manualSubmitting} required>
                      <option value="">— Choose Employee —</option>
                      {employees.map(emp => (
                        <option key={emp.user_id} value={emp.user_id}>{emp.username} (${emp.hourly_rate}/hr)</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Clock-In Date & Time</label>
                    <input type="datetime-local" value={manualClockIn} onChange={e => { setManualError(''); setManualClockIn(e.target.value); }} disabled={manualSubmitting} required />
                  </div>
                  <div className="form-group">
                    <label>Clock-Out Date & Time</label>
                    <input type="datetime-local" value={manualClockOut} onChange={e => { setManualError(''); setManualClockOut(e.target.value); }} disabled={manualSubmitting} required />
                  </div>
                  {manualHrsPreview && (
                    <div className="hours-preview">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      Total hours that will be logged: <strong>{manualHrsPreview} hrs</strong>
                    </div>
                  )}
                  <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: '1rem' }}
                    disabled={manualSubmitting || !manualUserId || !manualClockIn || !manualClockOut || !manualHrsPreview}>
                    {manualSubmitting ? 'Creating Entry...' : 'Create Manual Shift'}
                  </button>
                </form>
              </div>

              <div className="glass-card user-list-panel">
                <div className="content-header" style={{ marginBottom: '1.5rem' }}>
                  <div>
                    <h3>Edit Existing Pending Shifts</h3>
                    <p className="subheader-desc" style={{ marginTop: '0.35rem' }}>Click ✏️ Edit to correct any pending shift's clock-in or clock-out time.</p>
                  </div>
                </div>
                {shiftsLoading ? (
                  <div className="content-loading"><div className="spinner"></div></div>
                ) : allShifts.length === 0 ? (
                  <div className="content-empty"><p>No pending shifts available to edit.</p></div>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead><tr><th>Employee</th><th>Clock-In</th><th>Clock-Out</th><th>Hours</th><th>Edit</th></tr></thead>
                      <tbody>
                        {allShifts.map(shift => (
                          <tr key={shift.log_id}>
                            <td style={{ fontWeight: '600' }}>{shift.username}</td>
                            <td style={{ fontSize: '0.85rem' }}>{formatDate(shift.clock_in)}</td>
                            <td style={{ fontSize: '0.85rem' }}>{shift.clock_out ? formatDate(shift.clock_out) : <span className="running-shift">Active</span>}</td>
                            <td>{shift.total_hours ? Number(shift.total_hours).toFixed(2) + ' hrs' : '—'}</td>
                            <td>
                              <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(shift)} disabled={!shift.clock_out} title={!shift.clock_out ? 'Cannot edit an active shift' : 'Edit timestamps'}>
                                ✏️ Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---- TAB: USERS ---- */}
          {activeTab === 'users' && (
            <div className="admin-users-grid">
              <div className="glass-card user-form-panel">
                <div className="content-header" style={{ marginBottom: '1.5rem' }}>
                  <h3>Register New Account</h3>
                  <p className="subheader-desc">Create employee credentials or add a fellow administrator.</p>
                </div>
                <form onSubmit={handleAddUser}>
                  {formError && <div className="login-error">{formError}</div>}
                  {formSuccess && <div className="form-success">{formSuccess}</div>}
                  <div className="form-group"><label htmlFor="new-username">Username</label><input type="text" id="new-username" placeholder="e.g. bob_builder" value={newUsername} onChange={e => setNewUsername(e.target.value)} disabled={formSubmitting} required /></div>
                  <div className="form-group"><label htmlFor="new-password">Password / PIN</label><input type="password" id="new-password" placeholder="e.g. bobPIN789" value={newPassword} onChange={e => setNewPassword(e.target.value)} disabled={formSubmitting} required /></div>
                  <div className="form-group">
                    <label htmlFor="new-role">Role</label>
                    <select id="new-role" value={newRole} onChange={e => setNewRole(e.target.value)} disabled={formSubmitting}>
                      <option value="employee">Employee (Kiosk Visible)</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                  <div className="form-group"><label htmlFor="new-rate">Hourly Rate ($)</label><input type="number" step="0.01" min="0" id="new-rate" placeholder="e.g. 25.00" value={newRate} onChange={e => setNewRate(e.target.value)} disabled={formSubmitting || newRole === 'admin'} /></div>
                  <button type="submit" className="btn btn-primary btn-block" disabled={formSubmitting || !newUsername || !newPassword}>
                    {formSubmitting ? 'Registering...' : 'Register User'}
                  </button>
                </form>
              </div>
              <div className="glass-card user-list-panel">
                <div className="content-header" style={{ marginBottom: '1.5rem' }}>
                  <h3>Active Accounts ({users.length})</h3>
                </div>
                <div className="table-container">
                  <table>
                    <thead><tr><th>Username</th><th>Role</th><th>Hourly Rate</th><th>Action</th></tr></thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.user_id}>
                          <td style={{ fontWeight: '600' }}>{u.username}</td>
                          <td><span className={`badge ${u.role === 'admin' ? 'badge-warning' : 'badge-success'}`}><span className="badge-dot"></span>{u.role}</span></td>
                          <td>{u.role === 'admin' ? 'N/A' : `$${u.hourly_rate.toFixed(2)}/hr`}</td>
                          <td><button className="btn btn-danger btn-sm" disabled={u.user_id === currentAdmin.user_id} onClick={() => handleDeleteUser(u.user_id, u.username)}>Delete</button></td>
                        </tr>
                      ))}
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
