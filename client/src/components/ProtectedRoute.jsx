import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin mb-4" />
        <p className="text-sm text-slate-500 font-medium">Verifying authorization...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (location.pathname.startsWith('/admin')) {
      return <Navigate to="/login/admin" state={{ from: location }} replace />;
    }
    if (location.pathname.startsWith('/officer')) {
      return <Navigate to="/login/officer" state={{ from: location }} replace />;
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const currentRole = user?.role ? String(user.role).toLowerCase().trim() : '';
  const normalizedAllowedRoles = allowedRoles.map((r) => String(r).toLowerCase().trim());

  if (normalizedAllowedRoles.length > 0 && !normalizedAllowedRoles.includes(currentRole)) {
    // Redirect to their appropriate dashboard if wrong role
    if (currentRole === 'citizen') return <Navigate to="/dashboard" replace />;
    if (currentRole === 'officer') return <Navigate to="/officer/dashboard" replace />;
    if (currentRole === 'admin') return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
