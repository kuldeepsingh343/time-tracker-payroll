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

// Helper: Get Monday of the week for a given date
const getMondayDate = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

// Helper: Format a week date range starting Monday to Sunday
const formatWeekRange = (mondayDate) => {
  const sunday = new Date(mondayDate);
  sunday.setDate(mondayDate.getDate() + 6);
  const f = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${f(mondayDate)} – ${f(sunday)}, ${mondayDate.getFullYear()}`;
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
  const [allCompletedShifts, setAllCompletedShifts] = useState([]); // Both paid and pending completed shifts
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

  // Password Reset Modal State
  const [resettingUser, setResettingUser] = useState(null); // User object being reset
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

  // Date Filtering States (Unpaid Shifts tab)
  const [filterPreset, setFilterPreset] = useState('all'); // 'all' | 'week' | 'month' | 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Bulk Selection States
  const [selectedShiftIds, setSelectedShiftIds] = useState([]);
  const [bulkActionSubmitting, setBulkActionSubmitting] = useState(false);

  // All-Shifts list for corrections tab
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

  // Load all completed shifts (both paid and pending) for weekly summaries and corrections
  const loadAllCompletedShifts = useCallback(async () => {
    try {
      // Fetch users shifts or all historical shifts
      // We can fetch from employee history endpoints, but as admin we query payroll.
      // To get both paid and pending shifts, we will query custom logs
      // Let's load the payroll summary data which has pending, but we also query individual employee logs
      // Let's query admin/users, then for each user fetch logs to compile a true complete log history
      const response = await apiFetch('/admin/users');
      if (response.ok) {
        const usersList = await response.json();
        const employeesList = usersList.filter(u => u.role === 'employee');
        
        const allLogsPromises = employeesList.map(async (emp) => {
          const res = await apiFetch(`/employee/dashboard?user_id=${emp.user_id}`); // Back-compatible query param if backend supports, else custom logic
          if (res.ok) {
            const dashboardData = await res.json();
            return (dashboardData.logs || []).map(log => ({
              ...log,
              username: emp.username,
              hourly_rate: emp.hourly_rate
            }));
          }
          return [];
        });

        const results = await Promise.all(allLogsPromises);
        const flatLogs = results.flat();
        // Sort by clock_in descending
        flatLogs.sort((a, b) => new Date(b.clock_in) - new Date(a.clock_in));
        setAllCompletedShifts(flatLogs.filter(l => l.clock_out !== null));
      }
    } catch (err) {
      console.error('Error loading completed shifts:', err);
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
    await Promise.all([loadPayrollData(), loadUsersData(), loadAllCompletedShifts()]);
    setLoading(false);
  }, [loadPayrollData, loadUsersData, loadAllCompletedShifts]);

  useEffect(() => { loadAllData(); }, [loadAllData]);

  useEffect(() => {
    if (activeTab === 'manual') loadAllShifts();
  }, [activeTab, loadAllShifts]);

  // Set filter preset dates
  useEffect(() => {
    const today = new Date();
    if (filterPreset === 'week') {
      const monday = getMondayDate(today);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setStartDate(monday.toISOString().split('T')[0]);
      setEndDate(sunday.toISOString().split('T')[0]);
    } else if (filterPreset === 'month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(startOfMonth.toISOString().split('T')[0]);
      setEndDate(endOfMonth.toISOString().split('T')[0]);
    } else if (filterPreset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  }, [filterPreset]);

  // Apply filters to pending shifts
  const getFilteredShifts = () => {
    return pendingShifts.filter((shift) => {
      const shiftDate = new Date(shift.clock_in).toISOString().split('T')[0];
      if (startDate && shiftDate < startDate) return false;
      if (endDate && shiftDate > endDate) return false;
      return true;
    });
  };

  const filteredShifts = getFilteredShifts();

  // Handle shift checkmark selection
  const handleToggleSelectShift = (logId) => {
    setSelectedShiftIds((prev) =>
      prev.includes(logId) ? prev.filter((id) => id !== logId) : [...prev, logId]
    );
  };

  const handleSelectAllFiltered = () => {
    if (selectedShiftIds.length === filteredShifts.length) {
      setSelectedShiftIds([]);
    } else {
      setSelectedShiftIds(filteredShifts.map((s) => s.log_id));
    }
  };

  // Bulk pay shifts
  const handleBulkMarkPaid = async () => {
    if (selectedShiftIds.length === 0) return;
    if (!window.confirm(`Mark ${selectedShiftIds.length} shifts as paid?`)) return;
    
    setBulkActionSubmitting(true);
    try {
      const response = await apiFetch('/admin/shifts/bulk-pay', {
        method: 'PATCH',
        body: JSON.stringify({ logIds: selectedShiftIds })
      });
      if (response.ok) {
        setSelectedShiftIds([]);
        await loadAllData();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to update shifts');
      }
    } catch (err) {
      console.error('Error during bulk pay:', err);
    } finally {
      setBulkActionSubmitting(false);
    }
  };

  // Add User Handler
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

  // Delete User Handler
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

  // Mark Paid Handler
  const handleMarkPaid = async (logId) => {
    try {
      const response = await apiFetch(`/admin/shifts/${logId}/pay`, {
        method: 'PATCH',
        body: JSON.stringify({ payment_status: 'paid' })
      });
      if (response.ok) {
        await loadPayrollData();
        await loadAllCompletedShifts();
        await loadAllShifts();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to update shift');
      }
    } catch (err) {
      console.error('Error updating shift status:', err);
    }
  };

  // Manual Time Entry Handler
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

  // Open Edit Modal
  const openEditModal = (shift) => {
    setEditingShift(shift);
    setEditClockIn(toLocalInputValue(shift.clock_in));
    setEditClockOut(toLocalInputValue(shift.clock_out));
    setEditError('');
  };

  // Submit Edit
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

  // Open Reset Password dialog
  const openResetModal = (user) => {
    setResettingUser(user);
    setResetPassword('');
    setResetError('');
    setResetSuccess('');
  };

  // Submit Password Reset
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');
    if (!resetPassword) { setResetError('Password/PIN cannot be empty.'); return; }
    setResetSubmitting(true);
    try {
      const response = await apiFetch(`/admin/users/${resettingUser.user_id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password: resetPassword })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to reset password');
      setResetSuccess(data.message);
      setTimeout(() => setResettingUser(null), 1500);
    } catch (err) {
      setResetError(err.message || 'Error updating password');
    } finally {
      setResetSubmitting(false);
    }
  };

  // Compute Weekly Payroll Balances (Grouped by employee & week starting Monday)
  const getWeeklyPayrollSummaries = () => {
    const weeklyMap = {}; // key: employeeName_MondayDateString

    allCompletedShifts.forEach((shift) => {
      const monday = getMondayDate(shift.clock_in);
      const weekKey = `${shift.username}_${monday.toISOString().split('T')[0]}`;
      const hours = Number(shift.total_hours || 0);
      const rate = Number(shift.hourly_rate || 0);
      const payout = hours * rate;

      if (!weeklyMap[weekKey]) {
        weeklyMap[weekKey] = {
          username: shift.username,
          weekStart: monday,
          hourly_rate: rate,
          pending_hours: 0,
          pending_payout: 0,
          paid_hours: 0,
          paid_payout: 0
        };
      }

      if (shift.payment_status === 'paid') {
        weeklyMap[weekKey].paid_hours += hours;
        weeklyMap[weekKey].paid_payout += payout;
      } else {
        weeklyMap[weekKey].pending_hours += hours;
        weeklyMap[weekKey].pending_payout += payout;
      }
    });

    return Object.values(weeklyMap).sort((a, b) => b.weekStart - a.weekStart || a.username.localeCompare(b.username));
  };

  const weeklySummaries = getWeeklyPayrollSummaries();

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const totalOutstandingPayout = payrollSummary.reduce((acc, row) => acc + Number(row.pending_payout || 0), 0);
  const totalOutstandingHours = payrollSummary.reduce((acc, row) => acc + Number(row.pending_hours || 0), 0);
  const manualHrsPreview = calcHours(manualClockIn, manualClockOut);
  const editHrsPreview = calcHours(editClockIn, editClockOut);

  return (
    <div className="admin-container animate-slide-up">

      {/* ---- EDIT SHIFT MODAL ---- */}
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

      {/* ---- PASSWORD RESET MODAL ---- */}
      {resettingUser && (
        <div className="modal-backdrop animate-fade-in">
          <div className="modal-content glass-card animate-slide-up">
            <div className="modal-header">
              <div className="modal-icon-container" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <h3>Reset Account Passcode</h3>
              <p className="modal-subtitle">Setting new login key for <strong>{resettingUser.username}</strong></p>
            </div>
            <form onSubmit={handleResetSubmit}>
              {resetError && <div className="login-error" style={{ marginBottom: '1rem' }}>{resetError}</div>}
              {resetSuccess && <div className="form-success" style={{ marginBottom: '1rem' }}>{resetSuccess}</div>}
              <div className="form-group">
                <label>New Password / Touch-PIN</label>
                <input
                  type="password"
                  placeholder="Enter secure passcode/PIN"
                  value={resetPassword}
                  onChange={e => { setResetError(''); setResetPassword(e.target.value); }}
                  disabled={resetSubmitting}
                  required
                />
              </div>
              <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setResettingUser(null)} disabled={resetSubmitting}>Cancel</button>
                <button type="submit" className="btn btn-warning" disabled={resetSubmitting || !resetPassword}>
                  {resetSubmitting ? 'Updating...' : 'Confirm Reset'}
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
          <p>Register employees, monitor payouts, filter shift history, and manage credentials.</p>
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
              
              {/* Outstanding metrics */}
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

              {/* Unpaid Shifts with Date Filters */}
              <div className="dashboard-content glass-card" style={{ gridColumn: '1 / -1', marginBottom: '1.5rem' }}>
                <div className="content-header" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <h3>Unpaid Completed Shifts ({filteredShifts.length})</h3>
                    <p className="subheader-desc">Filter by date ranges, select multiple shifts, and mark them as paid in bulk.</p>
                  </div>
                  {/* Date Filters UI */}
                  <div className="filter-controls-row" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                      value={filterPreset}
                      onChange={(e) => setFilterPreset(e.target.value)}
                      style={{ padding: '0.4rem 0.8rem', background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff' }}
                    >
                      <option value="all">📅 All Dates</option>
                      <option value="week">📅 This Week (Mon-Sun)</option>
                      <option value="month">📅 This Month</option>
                      <option value="custom">📅 Custom Range</option>
                    </select>

                    {filterPreset === 'custom' && (
                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          style={{ padding: '0.35rem 0.6rem', background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                        />
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>to</span>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          style={{ padding: '0.35rem 0.6rem', background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                        />
                      </div>
                    )}

                    {selectedShiftIds.length > 0 && (
                      <button
                        onClick={handleBulkMarkPaid}
                        disabled={bulkActionSubmitting}
                        className="btn btn-success btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        ✅ Mark Selected ({selectedShiftIds.length}) Paid
                      </button>
                    )}
                  </div>
                </div>

                {filteredShifts.length === 0 ? (
                  <div className="content-empty"><p>No unpaid completed shifts found for the selected date range. 📅</p></div>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '40px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={selectedShiftIds.length === filteredShifts.length && filteredShifts.length > 0}
                              onChange={handleSelectAllFiltered}
                              style={{ transform: 'scale(1.15)', cursor: 'pointer' }}
                            />
                          </th>
                          <th>Employee</th><th>Clocked In</th><th>Clocked Out</th><th>Hours</th><th>Payout</th><th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredShifts.map((shift) => {
                          const hours = Number(shift.total_hours || 0);
                          const payout = hours * Number(shift.hourly_rate || 0);
                          const isSelected = selectedShiftIds.includes(shift.log_id);
                          return (
                            <tr key={shift.log_id} className={isSelected ? 'selected-row' : ''} style={{ background: isSelected ? 'rgba(99,102,241,0.06)' : '' }}>
                              <td style={{ textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectShift(shift.log_id)}
                                  style={{ transform: 'scale(1.15)', cursor: 'pointer' }}
                                />
                              </td>
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

              {/* Weekly Aggregated Summaries (Starting Monday) */}
              <div className="dashboard-content glass-card" style={{ gridColumn: '1 / -1', marginBottom: '1.5rem' }}>
                <div className="content-header">
                  <h3>Weekly Summaries</h3>
                  <p className="subheader-desc">Company-wide logged work grouped by week (starting Monday).</p>
                </div>
                {weeklySummaries.length === 0 ? (
                  <div className="content-empty"><p>No completed weekly summaries to show.</p></div>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Week</th>
                          <th>Employee</th>
                          <th>Hourly Rate</th>
                          <th>Pending Hours</th>
                          <th>Pending Payout</th>
                          <th>Paid Hours</th>
                          <th>Paid Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeklySummaries.map((summary, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600', color: '#a5b4fc' }}>{formatWeekRange(summary.weekStart)}</td>
                            <td style={{ fontWeight: '500' }}>{summary.username}</td>
                            <td>${summary.hourly_rate.toFixed(2)}/hr</td>
                            <td>{summary.pending_hours.toFixed(2)} hrs</td>
                            <td style={{ fontWeight: '600', color: summary.pending_payout > 0 ? 'var(--warning)' : 'inherit' }}>
                              ${summary.pending_payout.toFixed(2)}
                            </td>
                            <td>{summary.paid_hours.toFixed(2)} hrs</td>
                            <td style={{ fontWeight: '600', color: 'var(--success)' }}>${summary.paid_payout.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* General Employee Payroll Balances */}
              <div className="dashboard-content glass-card" style={{ gridColumn: '1 / -1' }}>
                <div className="content-header">
                  <h3>Lifetime Employee Payroll Balances</h3>
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
                            <td>${Number(emp.hourly_rate || 0).toFixed(2)}/hr</td>
                            <td>{Number(emp.pending_hours || 0).toFixed(2)} hrs</td>
                            <td style={{ fontWeight: '600', color: emp.pending_payout > 0 ? 'var(--warning)' : 'inherit' }}>${Number(emp.pending_payout || 0).toFixed(2)}</td>
                            <td>{Number(emp.paid_hours || 0).toFixed(2)} hrs</td>
                            <td style={{ fontWeight: '600', color: 'var(--success)' }}>${Number(emp.paid_payout || 0).toFixed(2)}</td>
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
                    <thead><tr><th>Username</th><th>Role</th><th>Hourly Rate</th><th>Actions</th></tr></thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.user_id}>
                          <td style={{ fontWeight: '600' }}>{u.username}</td>
                          <td><span className={`badge ${u.role === 'admin' ? 'badge-warning' : 'badge-success'}`}><span className="badge-dot"></span>{u.role}</span></td>
                          <td>{u.role === 'admin' ? 'N/A' : `$${Number(u.hourly_rate || 0).toFixed(2)}/hr`}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => openResetModal(u)}>🔑 Reset PIN</button>
                              <button className="btn btn-danger btn-sm" disabled={u.user_id === currentAdmin.user_id} onClick={() => handleDeleteUser(u.user_id, u.username)}>Delete</button>
                            </div>
                          </td>
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
