import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

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

const EmployeeDashboard = () => {
  const { apiFetch } = useAuth();
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeViewTab, setActiveViewTab] = useState('history'); // 'history' | 'weekly'

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Always fetch all logs so we can construct a correct weekly summary,
      // then filter logs client-side if statusFilter is active
      const response = await apiFetch('/employee/logs');
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        setSummary(data.summary || null);
      }
    } catch (err) {
      console.error('Error fetching employee dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

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

  // Filter logs list based on statusFilter tab
  const getFilteredLogs = () => {
    if (statusFilter === 'all') return logs;
    return logs.filter(log => log.payment_status === statusFilter);
  };

  const filteredLogs = getFilteredLogs();

  // Compute Weekly Summaries (Monday-start) for this Employee
  const getWeeklySummaries = () => {
    if (!summary || logs.length === 0) return [];
    
    const weeklyMap = {}; // key: MondayDateString

    logs.forEach((log) => {
      if (log.clock_out === null) return; // skip active shifts
      
      const monday = getMondayDate(log.clock_in);
      const weekKey = monday.toISOString().split('T')[0];
      const hours = Number(log.total_hours || 0);
      const rate = Number(summary.hourly_rate || 0);
      const payout = hours * rate;

      if (!weeklyMap[weekKey]) {
        weeklyMap[weekKey] = {
          weekStart: monday,
          hourly_rate: rate,
          pending_hours: 0,
          pending_payout: 0,
          paid_hours: 0,
          paid_payout: 0
        };
      }

      if (log.payment_status === 'paid') {
        weeklyMap[weekKey].paid_hours += hours;
        weeklyMap[weekKey].paid_payout += payout;
      } else {
        weeklyMap[weekKey].pending_hours += hours;
        weeklyMap[weekKey].pending_payout += payout;
      }
    });

    return Object.values(weeklyMap).sort((a, b) => b.weekStart - a.weekStart);
  };

  const weeklySummaries = getWeeklySummaries();

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
            <span className="rate-value">${Number(summary.hourly_rate || 0).toFixed(2)}/hr</span>
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
              <h3 className="stat-value">${Number(summary.pending_payout || 0).toFixed(2)}</h3>
              <span className="stat-sub">{Number(summary.pending_hours || 0).toFixed(2)} hours accumulated</span>
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
              <h3 className="stat-value">${Number(summary.paid_payout || 0).toFixed(2)}</h3>
              <span className="stat-sub">{Number(summary.paid_hours || 0).toFixed(2)} hours compensated</span>
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
              <h3 className="stat-value">{(Number(summary.pending_hours || 0) + Number(summary.paid_hours || 0)).toFixed(2)} hrs</h3>
              <span className="stat-sub">Lifetime logged work</span>
            </div>
          </div>
        </div>
      )}

      {/* Main View Selector Tab */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <button
          onClick={() => setActiveViewTab('history')}
          className={`tab-btn ${activeViewTab === 'history' ? 'active' : ''}`}
          style={{ padding: '0.65rem 1.25rem', background: activeViewTab === 'history' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
        >
          📄 Detailed History Logs
        </button>
        <button
          onClick={() => setActiveViewTab('weekly')}
          className={`tab-btn ${activeViewTab === 'weekly' ? 'active' : ''}`}
          style={{ padding: '0.65rem 1.25rem', background: activeViewTab === 'weekly' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
        >
          🗓️ Weekly Summaries (Mon-Sun)
        </button>
      </div>

      {/* History log section */}
      {activeViewTab === 'history' && (
        <div className="dashboard-content glass-card">
          <div className="content-header">
            <h3>Work History Logs</h3>
            
            {/* Status filters */}
            <div className="filter-tabs">
              <button className={`filter-tab ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>All Logs</button>
              <button className={`filter-tab ${statusFilter === 'pending' ? 'active' : ''}`} onClick={() => setStatusFilter('pending')}>Pending Payment</button>
              <button className={`filter-tab ${statusFilter === 'paid' ? 'active' : ''}`} onClick={() => setStatusFilter('paid')}>Paid</button>
            </div>
          </div>

          {loading ? (
            <div className="content-loading">
              <div className="spinner"></div>
              <p>Loading timesheets...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="content-empty">
              <p>No shift logs found matching the filter.</p>
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
                  {filteredLogs.map((log) => {
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
      )}

      {/* Weekly summaries section */}
      {activeViewTab === 'weekly' && (
        <div className="dashboard-content glass-card">
          <div className="content-header">
            <h3>Weekly Summaries</h3>
            <p className="subheader-desc">Your logged work, aggregated by week (starting Monday).</p>
          </div>

          {loading ? (
            <div className="content-loading">
              <div className="spinner"></div>
              <p>Loading summaries...</p>
            </div>
          ) : weeklySummaries.length === 0 ? (
            <div className="content-empty">
              <p>No completed weekly summaries to show yet.</p>
            </div>
          ) : (
            <div className="table-container animate-fade-in">
              <table>
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Hourly Rate</th>
                    <th>Pending Hours</th>
                    <th>Pending Payout</th>
                    <th>Paid Hours</th>
                    <th>Paid Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklySummaries.map((w, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: '600', color: '#a5b4fc' }}>{formatWeekRange(w.weekStart)}</td>
                      <td>${w.hourly_rate.toFixed(2)}/hr</td>
                      <td>{w.pending_hours.toFixed(2)} hrs</td>
                      <td style={{ fontWeight: '600', color: w.pending_payout > 0 ? 'var(--warning)' : 'inherit' }}>
                        ${w.pending_payout.toFixed(2)}
                      </td>
                      <td>{w.paid_hours.toFixed(2)} hrs</td>
                      <td style={{ fontWeight: '600', color: 'var(--success)' }}>${w.paid_payout.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;
