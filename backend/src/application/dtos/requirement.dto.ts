import { z } from 'zod';

// ─── Request Schemas ───────────────────────────────────────────────────────────

export const CreateRequirementSchema = z.object({
  title:       z.string().min(3).max(500).trim(),
  body:        z.string().min(10).max(50_000).trim(),
  type:        z.enum(['FUNCTIONAL', 'NON_FUNCTIONAL', 'BUSINESS', 'TECHNICAL', 'CONSTRAINT', 'ASSUMPTION'])
                .default('FUNCTIONAL'),
  priority:    z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  source:      z.string().max(200).optional(),
  tags:        z.array(z.string().max(50)).max(30).optional().default([]),
  parentId:    z.string().uuid().optional(),
  changeSummary: z.string().max(500).optional(),
});

export const UpdateRequirementSchema = CreateRequirementSchema.partial();

export const RequirementQuerySchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  limit:    z.coerce.number().int().min(1).max(100).default(20),
  status:   z.enum(['DRAFT', 'IN_ANALYSIS', 'ANALYZED', 'REVIEWED', 'APPROVED', 'ARCHIVED']).optional(),
  type:     z.enum(['FUNCTIONAL', 'NON_FUNCTIONAL', 'BUSINESS', 'TECHNICAL', 'CONSTRAINT', 'ASSUMPTION']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  search:   z.string().max(300).optional(),
  tags:     z.string().optional(), // comma-separated
  sortBy:   z.enum(['createdAt', 'updatedAt', 'title', 'priority', 'status']).default('createdAt'),
  sortDir:  z.enum(['asc', 'desc']).default('desc'),
});

export const LinkRequirementSchema = z.object({
  targetId: z.string().uuid(),
  linkType: z.enum(['RELATED', 'DEPENDS_ON', 'CONFLICTS_WITH', 'DUPLICATES', 'IMPLEMENTS']),
});

// ─── Inferred Types ────────────────────────────────────────────────────────────

export type CreateRequirementDto = z.infer<typeof CreateRequirementSchema>;
export type UpdateRequirementDto = z.infer<typeof UpdateRequirementSchema>;
export type RequirementQuery     = z.infer<typeof RequirementQuerySchema>;
export type LinkRequirementDto   = z.infer<typeof LinkRequirementSchema>;

// ─── Response DTOs ─────────────────────────────────────────────────────────────

export interface RequirementDto {
  id:            string;
  projectId:     string;
  title:         string;
  body:          string;
  type:          string;
  priority:      string;
  status:        string;
  source:        string | null;
  sourceFileUrl: string | null;
  tags:          string[];
  version:       number;
  wordCount:     number;
  parentId:      string | null;
  createdBy:     string;
  updatedBy:     string | null;
  analyzedAt:    string | null;
  approvedAt:    string | null;
  createdAt:     string;
  updatedAt:     string;
}

export interface RequirementVersionDto {
  id:            string;
  requirementId: string;
  version:       number;
  title:         string;
  body:          string;
  changedBy:     string;
  changeSummary: string | null;
  createdAt:     string;
}
