import { z } from 'zod';

// ─── Request Schemas ───────────────────────────────────────────────────────────

export const CreateProjectSchema = z.object({
  name:        z.string().min(2).max(200).trim(),
  description: z.string().max(2000).optional(),
  tags:        z.array(z.string().max(50)).max(20).optional().default([]),
});

export const UpdateProjectSchema = CreateProjectSchema.partial();

export const AddMemberSchema = z.object({
  userId: z.string().uuid(),
  role:   z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
});

export const ProjectQuerySchema = z.object({
  page:   z.coerce.number().int().positive().default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']).optional(),
  search: z.string().max(200).optional(),
});

// ─── Inferred Types ────────────────────────────────────────────────────────────

export type CreateProjectDto  = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectDto  = z.infer<typeof UpdateProjectSchema>;
export type AddMemberDto      = z.infer<typeof AddMemberSchema>;
export type ProjectQuery      = z.infer<typeof ProjectQuerySchema>;

// ─── Response DTOs ─────────────────────────────────────────────────────────────

export interface ProjectMemberDto {
  userId:     string;
  email:      string;
  firstName:  string;
  lastName:   string;
  role:       string;
  joinedAt:   string;
}

export interface ProjectDto {
  id:          string;
  name:        string;
  description: string | null;
  status:      string;
  ownerId:     string;
  isArchived:  boolean;
  tags:        string[];
  createdAt:   string;
  updatedAt:   string;
  memberCount?: number;
  requirementCount?: number;
}

export interface ProjectDashboardDto {
  projectId:            string;
  projectName:          string;
  totalRequirements:    number;
  analyzedCount:        number;
  approvedCount:        number;
  draftCount:           number;
  complexityLow:        number;
  complexityMedium:     number;
  complexityHigh:       number;
  complexityVeryHigh:   number;
  analysisCoveragePct:  number;
  lastRequirementUpdate: string | null;
  lastAnalysisAt:       string | null;
}
