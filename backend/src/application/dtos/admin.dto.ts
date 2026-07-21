import { z } from 'zod';
import { ALL_ROLES, UserRole } from '../../domain/types/UserRole';

// ─── Query schema ─────────────────────────────────────────────────────────────

export const AdminListUsersQuerySchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(100).default(20),
  role:     z.enum(ALL_ROLES).optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  search:   z.string().max(100).trim().optional(),
});

// ─── Body schemas ─────────────────────────────────────────────────────────────

export const ChangeRoleSchema = z.object({
  role: z.enum(ALL_ROLES),
});

export const ChangeStatusSchema = z.object({
  isActive: z.boolean(),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type AdminListUsersQuery = z.infer<typeof AdminListUsersQuerySchema>;
export type ChangeRoleDto       = z.infer<typeof ChangeRoleSchema>;
export type ChangeStatusDto     = z.infer<typeof ChangeStatusSchema>;

// ─── Response DTO ─────────────────────────────────────────────────────────────

export interface AdminUserDto {
  id:               string;
  email:            string;
  firstName:        string;
  lastName:         string;
  role:             UserRole;
  isActive:         boolean;
  isEmailVerified:  boolean;
  avatarUrl:        string | null;
  jobTitle:         string | null;
  department:       string | null;
  failedLoginCount: number;
  lockedUntil:      string | null;
  lastLoginAt:      string | null;
  createdAt:        string;
}
