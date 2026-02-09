function App() {
  const { user, profile, loading } = useAuth();
  
  if (loading) {
    return (
      <AppContent />
    );
  }

  if (!user) {
    return showLogin ? (
      <Login onToggle={() => setShowLogin(false)} />
    ) : (
      <Register onToggle={() => setShowLogin(true)} />
    );
  }

  if (profile?.role === 'admin') {
    return (
      <ProtectedRoute allowedRoles={['admin']}>
        <AdminDashboard />
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['borrower']}>
      <BorrowerDashboard />
    </ProtectedRoute>
  );
}

import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
