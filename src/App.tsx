function App() {
  const { user, profile, loading } = useAuth();
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
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
    </ProtectedRoute>
import { useAuth } from './hooks/useAuth';
