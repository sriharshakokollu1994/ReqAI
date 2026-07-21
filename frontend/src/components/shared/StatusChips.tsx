import React from 'react';
import { Chip } from '@mui/material';
import type { ChipProps } from '@mui/material';
import type { AnalysisStatus, RequirementStatus, RequirementPriority } from '../../types';

// ── Analysis status ───────────────────────────────────────────────────────────
const AS_MAP: Record<AnalysisStatus, { label: string; color: ChipProps['color'] }> = {
  QUEUED:     { label: 'Queued',     color: 'default'  },
  PROCESSING: { label: 'Processing', color: 'warning'  },
  COMPLETED:  { label: 'Completed',  color: 'success'  },
  FAILED:     { label: 'Failed',     color: 'error'    },
  CANCELLED:  { label: 'Cancelled',  color: 'default'  },
};
export const AnalysisStatusChip: React.FC<{ status: AnalysisStatus }> = ({ status }) => {
  const c = AS_MAP[status] ?? { label: status, color: 'default' as const };
  return <Chip label={c.label} color={c.color} size="small" />;
};

// ── Requirement status ────────────────────────────────────────────────────────
const RS_MAP: Record<RequirementStatus, { label: string; color: ChipProps['color'] }> = {
  DRAFT:        { label: 'Draft',        color: 'default'   },
  UNDER_REVIEW: { label: 'Under Review', color: 'warning'   },
  APPROVED:     { label: 'Approved',     color: 'success'   },
  REJECTED:     { label: 'Rejected',     color: 'error'     },
  ANALYZING:    { label: 'Analyzing',    color: 'info'      },
  ANALYZED:     { label: 'Analyzed',     color: 'primary'   },
  ARCHIVED:     { label: 'Archived',     color: 'default'   },
};
export const RequirementStatusChip: React.FC<{ status: RequirementStatus }> = ({ status }) => {
  const c = RS_MAP[status] ?? { label: status, color: 'default' as const };
  return <Chip label={c.label} color={c.color} size="small" />;
};

// ── Priority ──────────────────────────────────────────────────────────────────
const PRI_MAP: Record<RequirementPriority, { label: string; color: ChipProps['color'] }> = {
  CRITICAL: { label: 'Critical', color: 'error'   },
  HIGH:     { label: 'High',     color: 'warning' },
  MEDIUM:   { label: 'Medium',   color: 'primary' },
  LOW:      { label: 'Low',      color: 'default' },
};
export const PriorityChip: React.FC<{ priority: RequirementPriority }> = ({ priority }) => {
  const c = PRI_MAP[priority] ?? { label: priority, color: 'default' as const };
  return <Chip label={c.label} color={c.color} size="small" />;
};

// ── Complexity ────────────────────────────────────────────────────────────────
const CX_MAP: Record<string, { label: string; color: ChipProps['color'] }> = {
  LOW:       { label: 'Low',      color: 'success'  },
  MEDIUM:    { label: 'Medium',   color: 'warning'  },
  HIGH:      { label: 'High',     color: 'error'    },
  VERY_HIGH: { label: 'Very High',color: 'error'    },
};
export const ComplexityChip: React.FC<{ level: string | null }> = ({ level }) => {
  if (!level) return null;
  const c = CX_MAP[level] ?? { label: level, color: 'default' as const };
  return <Chip label={c.label} color={c.color} size="small" />;
};
