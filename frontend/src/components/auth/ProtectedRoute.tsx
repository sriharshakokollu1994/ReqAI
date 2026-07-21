import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAppSelector } from '../../app/hooks';
import { UserRole } from '../../types';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ProtectedRouteProps {
  /**
   * If provided, the authenticated user's role must appear in this list.
   * Users with a non-matching role are redirected to /dashboard.
   * Omit this prop to allow any authenticated user through (original behavior).
   */
  allowedRoles?: UserRole[];
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * ProtectedRoute — guards routes that require authentication.
 *
 * Behavior:
 *  - Not initialized yet  →  full-screen spinner (prevents flash of /login redirect)
 *  - Not authenticated    →  redirect to /login
 *  - Wrong role           →  redirect to /dashboard (graceful, not an error page)
 *  - Authenticated + role matches (or no role restriction)  →  render <Outlet />
 *
 * @example
 *   // Any authenticated user
 *   <Route element={<ProtectedRoute />}>...</Route>
 *
 * @example
 *   // ADMIN only
 *   <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>...</Route>
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { user, isInitialized } = useAppSelector((s) => s.auth);

  // Still checking session via /auth/me — show spinner to avoid flash
  if (!isInitialized) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Not logged in
  if (!user) return <Navigate to="/login" replace />;

  // Logged in but wrong role → gracefully bounce to dashboard
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};
