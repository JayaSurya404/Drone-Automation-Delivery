import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Skeleton } from '../components/common/Skeleton';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="main-content" style={{ maxWidth: '800px', marginTop: '2rem' }}>
        <Skeleton height={60} borderRadius="var(--radius-lg)" className="mb-4" />
        <Skeleton height={200} borderRadius="var(--radius-lg)" className="mb-4" />
        <Skeleton height={150} borderRadius="var(--radius-lg)" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user && !user.isVerified && user.accountStatus === 'pending_verification') {
    return <Navigate to="/verify-account" replace />;
  }

  return <>{children}</>;
};
