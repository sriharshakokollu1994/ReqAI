import React from 'react';
import { UserRole } from '../../types';
import { useAuth }  from '../../hooks/useAuth';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface RoleGuardProps {
  /**
   * User must have at least one of these exact roles.
   * If omitted (and minRole is also omitted), always renders children.
   */
  roles?:    UserRole[];

  /**
   * User's role rank must be >= this role's rank.
   * Mirrors requireMinRole() on the backend.
   */
  minRole?:  UserRole;

  /**
   * Rendered when the user does NOT meet the role requirement.
   * Defaults to null (renders nothing).
   */
  fallback?: React.ReactNode;

  children:  React.ReactNode;
}

/**
 * RoleGuard — conditionally renders children based on the current user's role.
 *
 * Does NOT redirect — use ProtectedRoute for route-level enforcement.
 * Use this component to show/hide UI elements inline.
 *
 * @example
 *   // Show admin button only to ADMIN users
 *   <RoleGuard roles={['ADMIN']}>
 *     <Button>Admin Panel</Button>
 *   </RoleGuard>
 *
 * @example
 *   // Require at least PROJECT_MANAGER level
 *   <RoleGuard minRole="PROJECT_MANAGER" fallback={<Typography>Access denied</Typography>}>
 *     <ManagerDashboard />
 *   </RoleGuard>
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({
  roles,
  minRole,
  fallback = null,
  children,
}) => {
  const { hasRole, can } = useAuth();

  const rolesOk   = roles   ? hasRole(...roles)  : true;
  const minRoleOk = minRole ? can(minRole)        : true;
  const allowed   = rolesOk && minRoleOk;

  return <>{allowed ? children : fallback}</>;
};
