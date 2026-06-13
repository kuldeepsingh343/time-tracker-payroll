import React, { useState, useEffect, useRef } from 'react';

const PasswordModal = ({ employee, action, onClose, onSubmit }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleKeyPress = (num) => {
    setError('');
    setPassword((prev) => prev + num);
  };

  const handleClear = () => {
    setPassword('');
  };

  const handleBackspace = () => {
    setPassword((prev) => prev.slice(0, -1));
  };

  const handleFormSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!password) {
      setError('Password/PIN is required');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onSubmit(employee.user_id, password, action);
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
      setPassword('');
      if (inputRef.current) inputRef.current.focus();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop animate-fade-in">
      <div className="modal-content glass-card animate-slide-up">
        <div className="modal-header">
          <div className="modal-icon-container">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" className="modal-icon">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h3>Confirm Identity</h3>
          <p className="modal-subtitle">
            Enter password to {action === 'clock_in' ? 'Clock In' : 'Clock Out'} for <strong>{employee.username}</strong>
          </p>
        </div>

        <form onSubmit={handleFormSubmit}>
          <div className="form-group">
            <input
              ref={inputRef}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setError('');
                setPassword(e.target.value);
              }}
              disabled={submitting}
              className="passcode-input"
            />
            {error && <span className="modal-error-message">{error}</span>}
          </div>

          {/* Touchscreen Pad (Great for Shared iPad/Tablet Kiosk) */}
          <div className="keypad-container">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                className="keypad-btn"
                onClick={() => handleKeyPress(num.toString())}
                disabled={submitting}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              className="keypad-btn keypad-special"
              onClick={handleClear}
              disabled={submitting}
            >
              C
            </button>
            <button
              type="button"
              className="keypad-btn"
              onClick={() => handleKeyPress('0')}
              disabled={submitting}
            >
              0
            </button>
            <button
              type="button"
              className="keypad-btn keypad-special"
              onClick={handleBackspace}
              disabled={submitting}
            >
              ⌫
            </button>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !password}
            >
              {submitting ? 'Verifying...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordModal;
