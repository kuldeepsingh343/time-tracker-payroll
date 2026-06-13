import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import PasswordModal from './PasswordModal';

const KioskView = () => {
  const { apiFetch } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  
  // Notification feedback toast
  const [toast, setToast] = useState(null);

  const loadEmployees = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/kiosk/employees`);
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const triggerToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => {
      setToast(null);
    }, 5000);
  };

  const handleClockAction = (employee, action) => {
    setSelectedEmployee(employee);
    setSelectedAction(action);
  };

  const handleConfirmPassword = async (userId, password, action) => {
    const response = await fetch(`${API_BASE_URL}/kiosk/clock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId, password, action })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Verification failed');
    }

    // Success
    triggerToast('success', data.message);
    setSelectedEmployee(null);
    setSelectedAction(null);
    loadEmployees(); // Reload list to update status
  };

  const filteredEmployees = employees.filter((emp) =>
    emp.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="kiosk-container animate-slide-up">
      {/* Toast Notification */}
      {toast && (
        <div className={`toast-notification ${toast.type === 'success' ? 'toast-success' : 'toast-error'} animate-fade-in`}>
          <div className="toast-icon">
            {toast.type === 'success' ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
          </div>
          <span className="toast-message">{toast.text}</span>
        </div>
      )}

      <div className="kiosk-header">
        <div className="header-info">
          <h2>Shared Kiosk Terminal</h2>
          <p>Select your profile to Clock In or Clock Out.</p>
        </div>
        <div className="search-bar-container">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className="search-icon">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search employee name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {loading ? (
        <div className="kiosk-loading">
          <div className="spinner"></div>
          <p>Loading Kiosk Roster...</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="kiosk-empty glass-card">
          <p>No employees found matching "{search}"</p>
        </div>
      ) : (
        <div className="kiosk-grid">
          {filteredEmployees.map((emp) => {
            const isClockedIn = emp.active_log_id !== null;
            return (
              <div key={emp.user_id} className={`employee-card glass-card ${isClockedIn ? 'is-clocked-in' : ''}`}>
                <div className="card-avatar">
                  {emp.username.substring(0, 2).toUpperCase()}
                </div>
                <h3 className="card-name">{emp.username}</h3>
                
                <div className="card-status">
                  <span className={`badge ${isClockedIn ? 'badge-success' : 'badge-danger'}`}>
                    <span className="badge-dot"></span>
                    {isClockedIn ? 'Clocked In' : 'Clocked Out'}
                  </span>
                </div>

                <div className="card-actions">
                  <button
                    className="btn btn-secondary btn-clock-in"
                    disabled={isClockedIn}
                    onClick={() => handleClockAction(emp, 'clock_in')}
                  >
                    Clock-In
                  </button>
                  <button
                    className="btn btn-secondary btn-clock-out"
                    disabled={!isClockedIn}
                    onClick={() => handleClockAction(emp, 'clock_out')}
                  >
                    Clock-Out
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedEmployee && selectedAction && (
        <PasswordModal
          employee={selectedEmployee}
          action={selectedAction}
          onClose={() => {
            setSelectedEmployee(null);
            setSelectedAction(null);
          }}
          onSubmit={handleConfirmPassword}
        />
      )}
    </div>
  );
};

export default KioskView;
