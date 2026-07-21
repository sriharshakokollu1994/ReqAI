import { z } from 'zod';

// ─── Request Schemas ───────────────────────────────────────────────────────────

export const TriggerAnalysisSchema = z.object({
  context:   z.string().max(2000).optional(),        // extra context hint for the AI
  forceNew:  z.boolean().optional().default(false),  // skip conflict check and re-run
  techStack: z.string().max(500).optional(),          // e.g. "Node.js, PostgreSQL, React"
  domain:    z.string().max(200).optional(),          // e.g. "fintech", "healthcare"
});

export const UpdateArtifactSchema = z.object({
  content: z.record(z.unknown()),             // free-form JSONB — validated per type in service
});

export const RateArtifactSchema = z.object({
  rating: z.number().int().min(1).max(5),
});

export const AnalysisHistoryQuerySchema = z.object({
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
  projectId: z.string().uuid().optional(),
  status:    z.enum(['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  provider:  z.enum(['OPENAI', 'AZURE_OPENAI', 'ANTHROPIC', 'WATSONX', 'CUSTOM']).optional(),
  from:      z.string().datetime().optional(),
  to:        z.string().datetime().optional(),
  sortBy:    z.enum(['completedAt', 'createdAt', 'tokensTotal', 'costUsd']).default('completedAt'),
  sortDir:   z.enum(['asc', 'desc']).default('desc'),
});

export const SaveAnalysisSchema = z.object({
  note: z.string().max(500).optional(),
});

// ─── Inferred Types ────────────────────────────────────────────────────────────

export type TriggerAnalysisDto   = z.infer<typeof TriggerAnalysisSchema>;
export type UpdateArtifactDto    = z.infer<typeof UpdateArtifactSchema>;
export type RateArtifactDto      = z.infer<typeof RateArtifactSchema>;
export type AnalysisHistoryQuery = z.infer<typeof AnalysisHistoryQuerySchema>;
export type SaveAnalysisDto      = z.infer<typeof SaveAnalysisSchema>;

// ─── Response DTOs ─────────────────────────────────────────────────────────────

export interface ArtifactDto {
  id:               string;
  analysisId:       string;
  artifactType:     string;
  content:          Record<string, unknown>;
  isEdited:         boolean;
  editedBy:         string | null;
  editedAt:         string | null;
  confidenceScore:  number | null;
  userRating:       number | null;
  createdAt:        string;
  updatedAt:        string;
}

export interface AnalysisDto {
  id:              string;
  requirementId:   string;
  triggeredBy:     string;
  status:          string;
  jobId:           string | null;
  aiProvider:      string;
  aiModel:         string;
  promptVersion:   string;
  tokensPrompt:    number | null;
  tokensCompletion: number | null;
  tokensTotal:     number | null;
  costUsd:         number | null;
  durationMs:      number | null;
  errorCode:       string | null;
  errorMessage:    string | null;
  retryCount:      number;
  queuedAt:        string;
  startedAt:       string | null;
  completedAt:     string | null;
  artifacts:       ArtifactDto[];
}

export interface AnalysisStatusDto {
  analysisId:  string;
  status:      string;
  progress:    number;           // 0–100 percent
  message:     string;
  completedAt: string | null;
}

export interface AnalysisHistoryItemDto {
  analysisId:       string;
  requirementId:    string;
  requirementTitle: string;
  projectId:        string;
  projectName:      string;
  status:           string;
  aiProvider:       string;
  aiModel:          string;
  complexityLevel:  string | null;
  riskCount:        number | null;
  storyCount:       number | null;
  tokensTotal:      number | null;
  costUsd:          number | null;
  triggeredBy:      string;
  completedAt:      string | null;
}

export interface TriggerAnalysisResponseDto {
  analysisId: string;
  status:     'queued';
  jobId:      string;
  message:    string;
}

export interface ExportUrlDto {
  url:       string;
  filename:  string;
  mimeType:  string;
  expiresAt: string;
}
