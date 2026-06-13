import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const EmployeeDashboard = () => {
  const { apiFetch } = useAuth();
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const url = statusFilter === 'all' 
        ? '/employee/logs' 
        : `/employee/logs?status=${statusFilter}`;
        
      const response = await apiFetch(url);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
        setSummary(data.summary);
      }
    } catch (err) {
      console.error('Error fetching employee dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, statusFilter]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="dashboard-container animate-slide-up">
      {summary && (
        <div className="dashboard-hero glass-panel">
          <div className="hero-details">
            <span className="welcome-label">Employee Portal</span>
            <h1>My Timesheet & Payroll</h1>
            <p>Track your completed hours, pending payouts, and historical records.</p>
          </div>
          <div className="rate-card glass-card">
            <span className="rate-label">Hourly Rate</span>
            <span className="rate-value">${summary.hourly_rate.toFixed(2)}/hr</span>
          </div>
        </div>
      )}

      {summary && (
        <div className="stats-grid grid-cols-3">
          {/* Pending Card */}
          <div className="stat-card glass-card pending-theme">
            <div className="stat-icon-container">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="stat-data">
              <span className="stat-label">Pending Payout</span>
              <h3 className="stat-value">${summary.pending_payout.toFixed(2)}</h3>
              <span className="stat-sub">{summary.pending_hours.toFixed(2)} hours accumulated</span>
            </div>
          </div>

          {/* Paid Card */}
          <div className="stat-card glass-card success-theme">
            <div className="stat-icon-container">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12" y2="18.01" />
                <line x1="12" y1="6" x2="12" y2="14" />
              </svg>
            </div>
            <div className="stat-data">
              <span className="stat-label">Paid Earnings</span>
              <h3 className="stat-value">${summary.paid_payout.toFixed(2)}</h3>
              <span className="stat-sub">{summary.paid_hours.toFixed(2)} hours compensated</span>
            </div>
          </div>

          {/* Total Combined Card */}
          <div className="stat-card glass-card total-theme">
            <div className="stat-icon-container">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div className="stat-data">
              <span className="stat-label">Total Completed Hours</span>
              <h3 className="stat-value">{(summary.pending_hours + summary.paid_hours).toFixed(2)} hrs</h3>
              <span className="stat-sub">Lifetime logged work</span>
            </div>
          </div>
        </div>
      )}

      {/* History log section */}
      <div className="dashboard-content glass-card">
        <div className="content-header">
          <h3>Work History Logs</h3>
          
          {/* Status filters */}
          <div className="filter-tabs">
            <button
              className={`filter-tab ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All Logs
            </button>
            <button
              className={`filter-tab ${statusFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pending')}
            >
              Pending Payment
            </button>
            <button
              className={`filter-tab ${statusFilter === 'paid' ? 'active' : ''}`}
              onClick={() => setStatusFilter('paid')}
            >
              Paid
            </button>
          </div>
        </div>

        {loading ? (
          <div className="content-loading">
            <div className="spinner"></div>
            <p>Loading timesheets...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="content-empty">
            <p>No shift logs found matching the selected filter.</p>
          </div>
        ) : (
          <div className="table-container animate-fade-in">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Hours Worked</th>
                  <th>Est. Earnings</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const hours = Number(log.total_hours || 0);
                  const earnings = hours * (summary?.hourly_rate || 0);
                  const isCurrentShift = log.clock_out === null;

                  return (
                    <tr key={log.log_id}>
                      <td style={{ fontWeight: '500' }}>{formatDate(log.clock_in)}</td>
                      <td>{formatTime(log.clock_in)}</td>
                      <td>
                        {isCurrentShift ? (
                          <span className="running-shift">Active Shift...</span>
                        ) : (
                          formatTime(log.clock_out)
                        )}
                      </td>
                      <td>
                        {isCurrentShift ? (
                          <span className="pulse">—</span>
                        ) : (
                          `${hours.toFixed(2)} hrs`
                        )}
                      </td>
                      <td>
                        {isCurrentShift ? (
                          <span className="pulse">—</span>
                        ) : (
                          `$${earnings.toFixed(2)}`
                        )}
                      </td>
                      <td>
                        {isCurrentShift ? (
                          <span className="badge badge-warning">
                            <span className="badge-dot"></span>
                            Clocked In
                          </span>
                        ) : log.payment_status === 'paid' ? (
                          <span className="badge badge-success">
                            <span className="badge-dot"></span>
                            Paid
                          </span>
                        ) : (
                          <span className="badge badge-danger">
                            <span className="badge-dot"></span>
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeDashboard;
