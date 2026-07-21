// ─── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  expiresIn:   number;
}

export interface LoginRequest    { email: string; password: string; }
export interface RegisterRequest { firstName: string; lastName: string; email: string; password: string; role?: UserRole; }

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface Project {
  id:          string;
  name:        string;
  description: string | null;
  status:      'ACTIVE' | 'ARCHIVED' | 'ON_HOLD';
  createdBy:   string;
  createdAt:   string;
  updatedAt:   string;
  memberCount: number;
  requirementCount: number;
}

// ─── Requirements ─────────────────────────────────────────────────────────────

export type UserRole =
  | 'ADMIN'
  | 'PROJECT_MANAGER'
  | 'BUSINESS_ANALYST'
  | 'DEVELOPER'
  | 'QA_ENGINEER'
  | 'ARCHITECT';

export interface User {
  id:              string;
  email:           string;
  firstName:       string;
  lastName:        string;
  role:            UserRole;
  isActive:        boolean;
  isEmailVerified: boolean;
  avatarUrl:       string | null;
  jobTitle:        string | null;
  department:      string | null;
  lastLoginAt:     string | null;
  createdAt:       string;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface AdminUser extends User {
  failedLoginCount: number;
  lockedUntil:      string | null;
}

export interface PaginatedUsers {
  users: AdminUser[];
  meta: {
    page:       number;
    limit:      number;
    total:      number;
    totalPages: number;
    hasNext:    boolean;
    hasPrev:    boolean;
  };
}

export interface UpdateProfileRequest {
  firstName?:  string;
  lastName?:   string;
  jobTitle?:   string;
  department?: string;
  avatarUrl?:  string;
}

// ─── Requirements ─────────────────────────────────────────────────────────────

export type RequirementType     = 'FUNCTIONAL' | 'NON_FUNCTIONAL' | 'BUSINESS' | 'TECHNICAL' | 'UI_UX' | 'SECURITY' | 'PERFORMANCE' | 'COMPLIANCE';
export type RequirementPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type RequirementStatus   = 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'ANALYZING' | 'ANALYZED' | 'ARCHIVED';

export interface Requirement {
  id:            string;
  projectId:     string;
  title:         string;
  body:          string;
  type:          RequirementType;
  priority:      RequirementPriority;
  status:        RequirementStatus;
  source:        string | null;
  tags:          string[];
  version:       number;
  wordCount:     number;
  analyzedAt:    string | null;
  createdBy:     string;
  createdAt:     string;
  updatedAt:     string;
}

// ─── Analyses & Artifacts ──────────────────────────────────────────────────────

export type AnalysisStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

/** v2 artifact types — matches DB enum (migration 012) and PromptBuilder v2 schema */
export type ArtifactType =
  | 'SUMMARY'
  | 'FUNCTIONAL_REQUIREMENTS'
  | 'NON_FUNCTIONAL_REQUIREMENTS'
  | 'BUSINESS_RULES'
  | 'ACTORS'
  | 'APIS'
  | 'DATABASE_TABLES'
  | 'VALIDATION_RULES'
  | 'ACCEPTANCE_CRITERIA'
  | 'DEPENDENCIES'
  | 'RISKS'
  | 'OPEN_QUESTIONS'
  | 'DEVELOPMENT_TASKS'
  | 'STORY_POINTS';

export interface Artifact {
  id:              string;
  analysisId:      string;
  artifactType:    ArtifactType;
  content:         Record<string, unknown>;
  isEdited:        boolean;
  editedBy:        string | null;
  editedAt:        string | null;
  confidenceScore: number | null;
  userRating:      number | null;
  createdAt:       string;
  updatedAt:       string;
}

export interface Analysis {
  id:               string;
  requirementId:    string;
  triggeredBy:      string;
  status:           AnalysisStatus;
  jobId:            string | null;
  aiProvider:       string;
  aiModel:          string;
  promptVersion:    string;
  tokensPrompt:     number | null;
  tokensCompletion: number | null;
  tokensTotal:      number | null;
  costUsd:          number | null;
  durationMs:       number | null;
  errorCode:        string | null;
  errorMessage:     string | null;
  retryCount:       number;
  queuedAt:         string;
  startedAt:        string | null;
  completedAt:      string | null;
  artifacts:        Artifact[];
}

export interface AnalysisStatus_ {
  analysisId:  string;
  status:      AnalysisStatus;
  progress:    number;
  message:     string;
  completedAt: string | null;
}

export interface HistoryItem {
  analysisId:       string;
  requirementId:    string;
  requirementTitle: string;
  projectId:        string;
  projectName:      string;
  status:           AnalysisStatus;
  aiProvider:       string;
  aiModel:          string;
  complexityLevel:  string | null;
  riskCount:        number | null;
  storyCount:       number | null;
  tokensTotal:      number | null;
  costUsd:          number | null;
  completedAt:      string | null;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export type ExportFormat = 'pdf' | 'docx' | 'markdown' | 'json';

export interface ExportJob {
  format:          ExportFormat;
  isLoading:       boolean;
  error:           string | null;
  lastExportedAt:  string | null;
}

export interface ExportFormatMeta {
  format:      ExportFormat;
  label:       string;
  description: string;
  icon:        string;
  extension:   string;
  mimeType:    string;
  sizeSuffix:  string; // e.g. "~120 KB"
}

// ─── API Shared ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  success: boolean;
  data:    T[];
  meta: {
    total:   number;
    page:    number;
    limit:   number;
    pages:   number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data:    T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: {
    code:    string;
    message: string;
    details?: { field: string; message: string }[];
  };
}
