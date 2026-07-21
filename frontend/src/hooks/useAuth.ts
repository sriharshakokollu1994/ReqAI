import { useAppSelector } from '../app/hooks';
import { UserRole } from '../types';

// ─── Role hierarchy ────────────────────────────────────────────────────────────
// Mirrors ROLE_HIERARCHY in backend/src/domain/types/UserRole.ts

const ROLE_RANKS: Record<UserRole, number> = {
  DEVELOPER:        0,
  QA_ENGINEER:      1,
  BUSINESS_ANALYST: 2,
  ARCHITECT:        3,
  PROJECT_MANAGER:  4,
  ADMIN:            5,
};

// ─── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useAuth — typed access to the current user's identity and role capabilities.
 *
 * @example
 *   const { isAdmin, can, user } = useAuth();
 *   if (!can('PROJECT_MANAGER')) return <AccessDenied />;
 */
export function useAuth() {
  const { user, accessToken, isLoading, isInitialized } = useAppSelector((s) => s.auth);

  const role: UserRole | null = (user?.role as UserRole) ?? null;

  /** True if the current user has exactly the ADMIN role. */
  const isAdmin = role === 'ADMIN';

  /** True if the current user has the DEVELOPER role. */
  const isDeveloper = role === 'DEVELOPER';

  /** True if the current user has the PROJECT_MANAGER role. */
  const isManager = role === 'PROJECT_MANAGER';

  /**
   * Returns true if the current user's role rank is >= the required minimum role.
   * Mirrors requireMinRole() on the backend.
   *
   * @example can('PROJECT_MANAGER') — true for ADMIN and PROJECT_MANAGER
   */
  function can(minRole: UserRole): boolean {
    if (!role) return false;
    const userRank = ROLE_RANKS[role] ?? -1;
    const minRank  = ROLE_RANKS[minRole] ?? Infinity;
    return userRank >= minRank;
  }

  /**
   * Returns true if the current user has at least one of the specified roles.
   * Mirrors authorize(...roles) on the backend.
   *
   * @example hasRole('ADMIN', 'PROJECT_MANAGER')
   */
  function hasRole(...roles: UserRole[]): boolean {
    if (!role) return false;
    return roles.includes(role);
  }

  return {
    user,
    role,
    accessToken,
    isLoading,
    isInitialized,
    isAdmin,
    isDeveloper,
    isManager,
    isAuthenticated: Boolean(user),
    can,
    hasRole,
  };
}
