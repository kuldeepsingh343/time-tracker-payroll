import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import KioskView from './components/KioskView';
import LoginView from './components/LoginView';
import EmployeeDashboard from './components/EmployeeDashboard';
import AdminDashboard from './components/AdminDashboard';
import './App.css';

// Protected Route for Employees
const EmployeeRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="login-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'employee') {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Protected Route for Admins
const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="login-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <main className="app-container">
          <Routes>
            {/* Public Kiosk Grid */}
            <Route path="/" element={<KioskView />} />
            
            {/* Login Portal */}
            <Route path="/login" element={<LoginView />} />
            
            {/* Protected Employee Dashboard */}
            <Route 
              path="/employee" 
              element={
                <EmployeeRoute>
                  <EmployeeDashboard />
                </EmployeeRoute>
              } 
            />
            
            {/* Protected Admin Dashboard */}
            <Route 
              path="/admin" 
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              } 
            />
            
            {/* Fallback redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </Router>
    </AuthProvider>
  );
}

export default App;
