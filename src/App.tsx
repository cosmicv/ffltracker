import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { BorrowerDashboard } from './pages/BorrowerDashboard';
import { SubscriptionPage } from './pages/SubscriptionPage';
import { SuccessPage } from './pages/SuccessPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/subscription"
          element={user ? <SubscriptionPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/success"
          element={user ? <SuccessPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/"
          element={
            user ? (
              profile?.role === 'admin' || profile?.role === 'master_admin' ? (
                <ProtectedRoute allowedRoles={['admin', 'master_admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              ) : (
                <ProtectedRoute allowedRoles={['borrower']}>
                  <BorrowerDashboard />
                </ProtectedRoute>
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
