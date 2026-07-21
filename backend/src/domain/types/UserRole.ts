/**
 * Canonical UserRole type for the entire ReqAI backend.
 *
 * Must stay in sync with the `user_role` PostgreSQL enum
 * defined in migration 001_create_extensions_and_types.sql.
 */

export type UserRole =
  | 'ADMIN'
  | 'PROJECT_MANAGER'
  | 'BUSINESS_ANALYST'
  | 'DEVELOPER'
  | 'QA_ENGINEER'
  | 'ARCHITECT';

/**
 * Role hierarchy ordered from lowest to highest privilege.
 * Used by requireMinRole() middleware to enforce rank comparisons.
 */
export const ROLE_HIERARCHY: readonly UserRole[] = [
  'DEVELOPER',
  'QA_ENGINEER',
  'BUSINESS_ANALYST',
  'ARCHITECT',
  'PROJECT_MANAGER',
  'ADMIN',
] as const;

/**
 * Returns the privilege rank of a role.
 * Returns -1 for unknown roles (effectively no access).
 */
export function roleRank(role: string): number {
  const idx = (ROLE_HIERARCHY as readonly string[]).indexOf(role);
  return idx;
}

/** All valid roles as an array — useful for Zod enum schema. */
export const ALL_ROLES: [UserRole, ...UserRole[]] = [
  'ADMIN',
  'PROJECT_MANAGER',
  'BUSINESS_ANALYST',
  'DEVELOPER',
  'QA_ENGINEER',
  'ARCHITECT',
];
