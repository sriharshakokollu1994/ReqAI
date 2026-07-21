import React, { useCallback, useRef, useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Button, TextField,
  MenuItem, Stack, LinearProgress, CircularProgress, Alert, Divider,
  Tooltip, IconButton, Chip, Tabs, Tab, alpha, useTheme, Table,
  TableHead, TableRow, TableCell, TableBody, Paper, Rating,
  Stepper, Step, StepLabel, StepContent, Badge,
} from '@mui/material';
import {
  AutoAwesomeRounded as AIIcon,
  PsychologyRounded,
  BookmarkAddRounded,
  RefreshRounded,
  ContentCopyRounded,
  CheckCircleRounded,
  ErrorRounded,
  HourglassEmptyRounded,
  SendRounded,
  ExpandMoreRounded,
  UploadFileRounded,
  PictureAsPdfRounded,
  ArticleRounded,
  CloseRounded,
  DescriptionRounded,
  WarningAmberRounded,
  QuestionAnswerRounded,
  AccountTreeRounded,
  StorageRounded,
  ApiRounded,
  ChecklistRounded,
  FunctionsRounded,
  SummarizeRounded,
  DownloadRounded,
  FileDownloadRounded,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  triggerAnalysisThunk, fetchAnalysisThunk, pollAnalysisStatusThunk,
  saveAnalysisThunk, rateArtifactThunk, clearCurrent,
} from '../features/analysis/analysisSlice';
import { createRequirementThunk } from '../features/requirements/requirementSlice';
import { showNotification } from '../features/notifications/notificationSlice';
import type { RequirementType, RequirementPriority, Artifact } from '../types';
import { AnalysisStatusChip } from '../components/shared/StatusChips';
import { PageHeader } from '../components/shared/PageHeader';
import { config } from '../config';
import { apiClient } from '../services/apiClient';

// ─────────────────────────────────────────────────────────────────────────────
// Tab configuration — 8 user-facing tabs mapped to v2 artifact types
// ─────────────────────────────────────────────────────────────────────────────

const RESULT_TABS = [
  {
    id:    'SUMMARY',
    label: 'Summary',
    icon:  <SummarizeRounded sx={{ fontSize: 16 }} />,
    desc:  'Executive summary, scope, complexity analysis',
    color: '#6C63FF',
  },
  {
    id:    'FUNCTIONAL_REQUIREMENTS',
    label: 'Functional Req.',
    icon:  <ChecklistRounded sx={{ fontSize: 16 }} />,
    desc:  'Functional requirements with MoSCoW priority',
    color: '#3B82F6',
  },
  {
    id:    'NON_FUNCTIONAL_REQUIREMENTS',
    label: 'Non-Functional',
    icon:  <FunctionsRounded sx={{ fontSize: 16 }} />,
    desc:  'Performance, security, scalability requirements',
    color: '#8B5CF6',
  },
  {
    id:    'APIS',
    label: 'API Suggestions',
    icon:  <ApiRounded sx={{ fontSize: 16 }} />,
    desc:  'REST API endpoints with request/response contracts',
    color: '#10B981',
  },
  {
    id:    'DATABASE_TABLES',
    label: 'Database Design',
    icon:  <StorageRounded sx={{ fontSize: 16 }} />,
    desc:  'Tables, columns, indexes, foreign-key constraints',
    color: '#F59E0B',
  },
  {
    id:    'ACCEPTANCE_CRITERIA',
    label: 'Acceptance Criteria',
    icon:  <AccountTreeRounded sx={{ fontSize: 16 }} />,
    desc:  'Gherkin Given / When / Then acceptance scenarios',
    color: '#06B6D4',
  },
  {
    id:    'RISKS',
    label: 'Risks',
    icon:  <WarningAmberRounded sx={{ fontSize: 16 }} />,
    desc:  'Risk register with probability × impact scoring',
    color: '#EF4444',
  },
  {
    id:    'OPEN_QUESTIONS',
    label: 'Questions',
    icon:  <QuestionAnswerRounded sx={{ fontSize: 16 }} />,
    desc:  'Open questions and unresolved assumptions',
    color: '#EC4899',
  },
] as const;

type ResultTabId = typeof RESULT_TABS[number]['id'];

// ─────────────────────────────────────────────────────────────────────────────
// Analysis step labels (shown in the stepper while processing)
// ─────────────────────────────────────────────────────────────────────────────

const ANALYSIS_STEPS = [
  { label: 'Requirement saved',      desc: 'Persisted to project' },
  { label: 'Analysis queued',         desc: 'Job submitted to worker' },
  { label: 'AI model processing',     desc: 'Generating structured artifacts' },
  { label: 'Artifacts validated',     desc: 'Schema & confidence scoring' },
  { label: 'Results ready',           desc: 'All 8 artifact types generated' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper: colour for priority/risk/method chips
// ─────────────────────────────────────────────────────────────────────────────

function priorityColor(p?: string): 'error' | 'warning' | 'info' | 'success' | 'default' {
  if (p === 'MUST_HAVE' || p === 'CRITICAL' || p === 'HIGH')  return 'error';
  if (p === 'SHOULD_HAVE' || p === 'MEDIUM')                  return 'warning';
  if (p === 'COULD_HAVE' || p === 'LOW')                      return 'info';
  if (p === 'WONT_HAVE')                                       return 'success';
  return 'default';
}

function methodColor(m?: string): string {
  const map: Record<string, string> = {
    GET: '#10B981', POST: '#3B82F6', PUT: '#F59E0B',
    PATCH: '#8B5CF6', DELETE: '#EF4444',
  };
  return map[m?.toUpperCase() ?? ''] ?? '#6B7280';
}

function riskLevelColor(level?: string): 'error' | 'warning' | 'success' | 'default' {
  if (level === 'CRITICAL' || level === 'HIGH')  return 'error';
  if (level === 'MEDIUM')                         return 'warning';
  if (level === 'LOW')                            return 'success';
  return 'default';
}

// ─────────────────────────────────────────────────────────────────────────────
// Artifact content renderers for each tab
// ─────────────────────────────────────────────────────────────────────────────

const RenderSummary: React.FC<{ content: any }> = ({ content: c }) => (
  <Stack spacing={2.5}>
    {c.executive && (
      <Box>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>Executive Summary</Typography>
        <Typography variant="body2" lineHeight={1.8} color="text.secondary">{c.executive}</Typography>
      </Box>
    )}
    {c.scope && (
      <Box>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>Scope</Typography>
        <Typography variant="body2" lineHeight={1.8} color="text.secondary">{c.scope}</Typography>
      </Box>
    )}
    {Array.isArray(c.keyPoints) && c.keyPoints.length > 0 && (
      <Box>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>Key Points</Typography>
        <Stack spacing={0.75}>
          {c.keyPoints.map((pt: string, i: number) => (
            <Box key={i} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', mt: 0.75, flexShrink: 0 }} />
              <Typography variant="body2" color="text.secondary">{pt}</Typography>
            </Box>
          ))}
        </Stack>
      </Box>
    )}
    {c.complexity && (
      <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>Complexity</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip label={`Level: ${c.complexity.level ?? 'N/A'}`} size="small" color="primary" />
          <Chip label={`Score: ${c.complexity.score ?? 'N/A'}/100`} size="small" variant="outlined" />
        </Box>
        {c.complexity.reasoning && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {c.complexity.reasoning}
          </Typography>
        )}
      </Box>
    )}
  </Stack>
);

const RenderFunctionalRequirements: React.FC<{ content: any }> = ({ content: c }) => {
  const reqs: any[] = c.requirements ?? (Array.isArray(c) ? c : []);
  if (!reqs.length) return <Typography color="text.secondary">No functional requirements generated.</Typography>;
  return (
    <Stack spacing={1.5}>
      {reqs.map((r: any, i: number) => (
        <Paper key={i} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1 }}>
            <Chip label={`FR-${String(i + 1).padStart(3, '0')}`} size="small" variant="outlined" color="primary" sx={{ fontFamily: 'monospace', fontSize: 11 }} />
            <Chip label={r.priority ?? 'N/A'} size="small" color={priorityColor(r.priority)} />
            {r.category && <Chip label={r.category} size="small" variant="outlined" />}
            <Typography variant="body2" fontWeight={700} sx={{ flex: 1 }}>{r.title ?? ''}</Typography>
          </Box>
          {r.description && (
            <Typography variant="body2" color="text.secondary" lineHeight={1.7}>{r.description}</Typography>
          )}
          {Array.isArray(r.acceptanceCriteria) && r.acceptanceCriteria.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.disabled" fontWeight={700} textTransform="uppercase" letterSpacing={0.5}>
                Acceptance Criteria
              </Typography>
              {r.acceptanceCriteria.map((ac: string, j: number) => (
                <Box key={j} sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                  <CheckCircleRounded sx={{ fontSize: 14, color: 'success.main', mt: 0.2, flexShrink: 0 }} />
                  <Typography variant="caption" color="text.secondary">{ac}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      ))}
    </Stack>
  );
};

const RenderNonFunctionalRequirements: React.FC<{ content: any }> = ({ content: c }) => {
  const reqs: any[] = c.requirements ?? (Array.isArray(c) ? c : []);
  if (!reqs.length) return <Typography color="text.secondary">No non-functional requirements generated.</Typography>;
  return (
    <Stack spacing={1.5}>
      {reqs.map((r: any, i: number) => (
        <Paper key={i} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip label={r.category ?? 'NFR'} size="small" color="secondary" />
            <Typography variant="body2" fontWeight={700}>{r.title ?? ''}</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: r.description ? 1 : 0 }}>
            {r.metric     && <Chip label={`Metric: ${r.metric}`} size="small" variant="outlined" />}
            {r.target     && <Chip label={`Target: ${r.target}`} size="small" variant="outlined" />}
            {r.threshold  && <Chip label={`Threshold: ${r.threshold}`} size="small" variant="outlined" />}
          </Box>
          {r.description && (
            <Typography variant="body2" color="text.secondary" lineHeight={1.7}>{r.description}</Typography>
          )}
        </Paper>
      ))}
    </Stack>
  );
};

const RenderApis: React.FC<{ content: any }> = ({ content: c }) => {
  const endpoints: any[] = c.endpoints ?? (Array.isArray(c) ? c : []);
  if (!endpoints.length) return <Typography color="text.secondary">No API endpoints generated.</Typography>;
  return (
    <Stack spacing={2}>
      {endpoints.map((ep: any, i: number) => (
        <Paper key={i} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          {/* Method + path header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, bgcolor: 'action.hover' }}>
            <Box sx={{
              px: 1, py: 0.25, borderRadius: 1,
              bgcolor: alpha(methodColor(ep.method), 0.15),
              border: `1px solid ${alpha(methodColor(ep.method), 0.3)}`,
            }}>
              <Typography variant="caption" fontWeight={800} fontFamily="monospace"
                sx={{ color: methodColor(ep.method), letterSpacing: 0.5 }}>
                {ep.method ?? 'GET'}
              </Typography>
            </Box>
            <Typography variant="body2" fontFamily="monospace" fontWeight={600} sx={{ flex: 1 }}>
              {ep.path ?? '/'}
            </Typography>
            {ep.auth && <Chip label={ep.auth} size="small" color="warning" variant="outlined" />}
            {(ep.authRequired === true) && !ep.auth && (
              <Chip label="Auth required" size="small" color="warning" variant="outlined" />
            )}
          </Box>
          <Box sx={{ p: 2 }}>
            {ep.summary && (
              <Typography variant="body2" color="text.secondary" mb={1}>{ep.summary}</Typography>
            )}
            {/* Query params */}
            {Array.isArray(ep.queryParams) && ep.queryParams.length > 0 && (
              <Box mb={1}>
                <Typography variant="caption" fontWeight={700} color="text.disabled" textTransform="uppercase" letterSpacing={0.5}>
                  Query Params
                </Typography>
                <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {ep.queryParams.map((p: any, j: number) => (
                    <Chip key={j} size="small" variant="outlined"
                      label={`${p.name}: ${p.type}${p.required ? ' *' : ''}`}
                      sx={{ fontFamily: 'monospace', fontSize: 10 }} />
                  ))}
                </Box>
              </Box>
            )}
            {/* Request body */}
            {ep.requestBody && (
              <Box mb={1}>
                <Typography variant="caption" fontWeight={700} color="text.disabled" textTransform="uppercase" letterSpacing={0.5}>
                  Request Body
                </Typography>
                <Paper variant="outlined" sx={{ p: 1.25, mt: 0.5, bgcolor: 'action.hover' }}>
                  <Typography variant="caption" fontFamily="monospace" component="pre"
                    sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.6 }}>
                    {JSON.stringify(ep.requestBody, null, 2)}
                  </Typography>
                </Paper>
              </Box>
            )}
            {/* Error codes */}
            {Array.isArray(ep.errorCodes) && ep.errorCodes.length > 0 && (
              <Box>
                <Typography variant="caption" fontWeight={700} color="text.disabled" textTransform="uppercase" letterSpacing={0.5}>
                  Error Codes
                </Typography>
                <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {ep.errorCodes.map((e: any, j: number) => (
                    <Chip key={j} size="small" variant="outlined" color="error"
                      label={`${e.status ?? e}: ${e.message ?? ''}`}
                      sx={{ fontFamily: 'monospace', fontSize: 10 }} />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </Paper>
      ))}
    </Stack>
  );
};

const RenderDatabaseTables: React.FC<{ content: any }> = ({ content: c }) => {
  const tables: any[] = c.tables ?? (Array.isArray(c) ? c : []);
  if (!tables.length) return <Typography color="text.secondary">No database tables generated.</Typography>;
  return (
    <Stack spacing={3}>
      {tables.map((tbl: any, i: number) => (
        <Box key={i}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <StorageRounded sx={{ fontSize: 18, color: 'warning.main' }} />
            <Typography variant="subtitle2" fontWeight={700} fontFamily="monospace">
              {tbl.tableName ?? tbl.name ?? 'unknown'}
            </Typography>
            {tbl.description && (
              <Typography variant="caption" color="text.secondary">— {tbl.description}</Typography>
            )}
          </Box>
          {/* Column table */}
          {Array.isArray(tbl.columns) && (
            <Box sx={{ overflowX: 'auto', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, bgcolor: 'action.hover' } }}>
                    <TableCell>Column</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Nullable</TableCell>
                    <TableCell>Constraints</TableCell>
                    <TableCell>Description</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tbl.columns.map((col: any, j: number) => (
                    <TableRow key={j} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, fontWeight: col.primaryKey ? 700 : 400 }}>
                        {col.primaryKey && <span style={{ color: '#F59E0B', marginRight: 4 }}>🔑</span>}
                        {col.name ?? col.columnName ?? ''}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 11, color: 'primary.main' }}>
                        {col.type ?? col.dataType ?? ''}
                      </TableCell>
                      <TableCell>
                        <Chip label={col.nullable ? 'NULL' : 'NOT NULL'} size="small"
                          color={col.nullable ? 'default' : 'warning'} variant="outlined"
                          sx={{ fontSize: 10, fontFamily: 'monospace' }} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                          {col.unique    && <Chip label="UNIQUE"  size="small" color="primary" variant="outlined" sx={{ fontSize: 9 }} />}
                          {col.indexed   && <Chip label="INDEX"   size="small" color="info"    variant="outlined" sx={{ fontSize: 9 }} />}
                          {col.default != null && <Chip label={`DEFAULT: ${col.default}`} size="small" variant="outlined" sx={{ fontSize: 9 }} />}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontSize: 11, color: 'text.secondary' }}>
                        {col.description ?? ''}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
          {/* Indexes */}
          {Array.isArray(tbl.indexes) && tbl.indexes.length > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="caption" fontWeight={700} color="text.disabled" textTransform="uppercase">Indexes</Typography>
              <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {tbl.indexes.map((idx: any, j: number) => (
                  <Chip key={j} size="small" variant="outlined"
                    label={`${idx.name ?? idx}: ${(idx.columns ?? []).join(', ')} (${idx.type ?? 'BTREE'})`}
                    sx={{ fontFamily: 'monospace', fontSize: 10 }} />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      ))}
    </Stack>
  );
};

const RenderAcceptanceCriteria: React.FC<{ content: any }> = ({ content: c }) => {
  const criteria: any[] = c.criteria ?? (Array.isArray(c) ? c : []);
  if (!criteria.length) return <Typography color="text.secondary">No acceptance criteria generated.</Typography>;
  return (
    <Stack spacing={2}>
      {criteria.map((ac: any, i: number) => (
        <Paper key={i} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ px: 2, py: 1.25, bgcolor: alpha('#06B6D4', 0.08), borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" fontWeight={700} color="info.main">
              Scenario {i + 1}{ac.scenario ? `: ${ac.scenario}` : (ac.title ? `: ${ac.title}` : '')}
            </Typography>
          </Box>
          <Box sx={{ p: 2 }}>
            <Stack spacing={1}>
              {[
                { label: 'GIVEN', text: ac.given, color: '#8B5CF6' },
                { label: 'WHEN',  text: ac.when,  color: '#3B82F6' },
                { label: 'THEN',  text: ac.then,  color: '#10B981' },
              ].filter((r) => r.text).map(({ label, text, color }) => (
                <Box key={label} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                  <Box sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: alpha(color, 0.12), flexShrink: 0 }}>
                    <Typography variant="caption" fontWeight={800} fontFamily="monospace" sx={{ color, letterSpacing: 0.5 }}>
                      {label}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" lineHeight={1.7}>{text}</Typography>
                </Box>
              ))}
              {/* AND blocks */}
              {Array.isArray(ac.and) && ac.and.map((a: string, j: number) => (
                <Box key={j} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                  <Box sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: alpha('#10B981', 0.12), flexShrink: 0 }}>
                    <Typography variant="caption" fontWeight={800} fontFamily="monospace" sx={{ color: '#10B981', letterSpacing: 0.5 }}>
                      AND
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" lineHeight={1.7}>{a}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        </Paper>
      ))}
    </Stack>
  );
};

const RenderRisks: React.FC<{ content: any }> = ({ content: c }) => {
  const risks: any[] = c.risks ?? (Array.isArray(c) ? c : []);
  if (!risks.length) return <Typography color="text.secondary">No risks identified.</Typography>;
  return (
    <Stack spacing={1.5}>
      {risks.map((r: any, i: number) => {
        const level = r.overallRisk ?? r.severity ?? r.level ?? 'MEDIUM';
        return (
          <Paper key={i} variant="outlined" sx={{
            borderRadius: 2, overflow: 'hidden',
            borderColor: level === 'CRITICAL' || level === 'HIGH' ? 'error.main'
              : level === 'MEDIUM' ? 'warning.main' : 'success.main',
            borderWidth: 1,
          }}>
            <Box sx={{
              px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.5,
              bgcolor: level === 'CRITICAL' || level === 'HIGH' ? alpha('#EF4444', 0.07)
                : level === 'MEDIUM' ? alpha('#F59E0B', 0.07) : alpha('#10B981', 0.07),
              borderBottom: '1px solid', borderColor: 'divider',
            }}>
              <Chip label={level} size="small" color={riskLevelColor(level)} />
              {r.category && <Chip label={r.category} size="small" variant="outlined" />}
              <Typography variant="body2" fontWeight={700} sx={{ flex: 1 }}>{r.title ?? ''}</Typography>
              {r.riskScore != null && (
                <Chip label={`Score: ${r.riskScore}`} size="small" variant="outlined"
                  color={r.riskScore >= 6 ? 'error' : r.riskScore >= 4 ? 'warning' : 'success'} />
              )}
            </Box>
            <Box sx={{ p: 2 }}>
              {r.description && (
                <Typography variant="body2" color="text.secondary" mb={1.25} lineHeight={1.7}>
                  {r.description}
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: r.mitigation ? 1 : 0 }}>
                {r.probability && <Chip label={`Probability: ${r.probability}`} size="small" variant="outlined" />}
                {r.impact      && <Chip label={`Impact: ${r.impact}`}           size="small" variant="outlined" />}
                {r.owner       && <Chip label={`Owner: ${r.owner}`}             size="small" variant="outlined" />}
              </Box>
              {r.mitigation && (
                <Box sx={{ mt: 1, p: 1.25, borderRadius: 1.5, bgcolor: alpha('#10B981', 0.08), border: `1px solid ${alpha('#10B981', 0.2)}` }}>
                  <Typography variant="caption" fontWeight={700} color="success.main" textTransform="uppercase" letterSpacing={0.5}>
                    Mitigation
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mt={0.25} lineHeight={1.6}>{r.mitigation}</Typography>
                </Box>
              )}
            </Box>
          </Paper>
        );
      })}
    </Stack>
  );
};

const RenderOpenQuestions: React.FC<{ content: any }> = ({ content: c }) => {
  const questions: any[] = c.questions ?? (Array.isArray(c) ? c : []);
  if (!questions.length) return <Typography color="text.secondary">No open questions identified.</Typography>;
  return (
    <Stack spacing={1.5}>
      {questions.map((q: any, i: number) => (
        <Paper key={i} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
            <Chip label={`Q${i + 1}`} size="small" color="secondary" sx={{ fontFamily: 'monospace', fontWeight: 700 }} />
            {q.priority && <Chip label={q.priority} size="small" color={priorityColor(q.priority)} />}
            {q.category && <Chip label={q.category} size="small" variant="outlined" />}
          </Box>
          <Typography variant="body2" fontWeight={600} mb={0.75}>{q.question ?? ''}</Typography>
          {q.impact && (
            <Typography variant="body2" color="text.secondary" mb={0.5}>
              <strong>Impact:</strong> {q.impact}
            </Typography>
          )}
          {q.suggestedOwner ?? q.owner
            ? <Chip label={`Owner: ${q.suggestedOwner ?? q.owner}`} size="small" variant="outlined" />
            : null}
          {q.assumption && (
            <Box sx={{ mt: 1, p: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
              <Typography variant="caption" color="text.disabled">Assumption: {q.assumption}</Typography>
            </Box>
          )}
        </Paper>
      ))}
    </Stack>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ArtifactTab — routes to the right renderer
// ─────────────────────────────────────────────────────────────────────────────

const ArtifactTabContent: React.FC<{ tabId: ResultTabId; artifact: Artifact | null }> = ({ tabId, artifact }) => {
  if (!artifact) return (
    <Box sx={{ textAlign: 'center', py: 6 }}>
      <Typography color="text.disabled">This artifact was not generated. Run a new analysis.</Typography>
    </Box>
  );
  const c = artifact.content as any;
  switch (tabId) {
    case 'SUMMARY':                    return <RenderSummary content={c} />;
    case 'FUNCTIONAL_REQUIREMENTS':    return <RenderFunctionalRequirements content={c} />;
    case 'NON_FUNCTIONAL_REQUIREMENTS': return <RenderNonFunctionalRequirements content={c} />;
    case 'APIS':                       return <RenderApis content={c} />;
    case 'DATABASE_TABLES':            return <RenderDatabaseTables content={c} />;
    case 'ACCEPTANCE_CRITERIA':        return <RenderAcceptanceCriteria content={c} />;
    case 'RISKS':                      return <RenderRisks content={c} />;
    case 'OPEN_QUESTIONS':             return <RenderOpenQuestions content={c} />;
    default:
      return (
        <Typography component="pre" variant="caption" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: 1.7 }}>
          {JSON.stringify(c, null, 2)}
        </Typography>
      );
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Upload Drop Zone
// ─────────────────────────────────────────────────────────────────────────────

const UploadZone: React.FC<{
  onExtracted: (text: string, filename: string) => void;
}> = ({ onExtracted }) => {
  const theme = useTheme();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractText = async (file: File): Promise<string> => {
    // For DOCX/PDF we read as text (plaintext extraction fallback).
    // In production integrate pdf.js / mammoth.js.
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        // Strip binary noise for non-text files — keep printable ASCII
        const cleaned = result.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{3,}/g, '\n').trim();
        resolve(cleaned.length > 50 ? cleaned : `[File: ${file.name}] — Text extraction requires a backend parser. Paste the requirement text manually.`);
      };
      reader.onerror = reject;
      reader.readAsText(file, 'utf-8');
    });
  };

  const handleFile = async (file: File) => {
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    const allowedExt = ['.pdf', '.docx', '.txt'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    if (!allowed.includes(file.type) && !allowedExt.includes(ext)) {
      return;
    }

    setIsProcessing(true);
    setUploadedFile({ name: file.name, size: file.size });
    try {
      const text = await extractText(file);
      onExtracted(text, file.name);
    } finally {
      setIsProcessing(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <Box>
      <Box
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        sx={{
          border: `2px dashed ${isDragging ? theme.palette.primary.main : theme.palette.divider}`,
          borderRadius: 2,
          py: 2, px: 2,
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          bgcolor: isDragging ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: alpha(theme.palette.primary.main, 0.04),
          },
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        {isProcessing ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">Extracting text…</Typography>
          </Box>
        ) : uploadedFile ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
            <CheckCircleRounded sx={{ fontSize: 16, color: 'success.main' }} />
            <Typography variant="caption" fontWeight={600} color="success.main">{uploadedFile.name}</Typography>
            <Typography variant="caption" color="text.disabled">({(uploadedFile.size / 1024).toFixed(0)} KB)</Typography>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setUploadedFile(null); onExtracted('', ''); }}>
              <CloseRounded sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'center' }}>
            <UploadFileRounded sx={{ fontSize: 20, color: 'text.disabled' }} />
            <Box sx={{ textAlign: 'left' }}>
              <Typography variant="caption" fontWeight={600} color="text.secondary">
                Drop file or click to upload
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.25 }}>
                <Chip icon={<PictureAsPdfRounded sx={{ fontSize: 12 }} />} label="PDF" size="small" variant="outlined" sx={{ fontSize: 10, height: 20 }} />
                <Chip icon={<ArticleRounded sx={{ fontSize: 12 }} />} label="DOCX" size="small" variant="outlined" sx={{ fontSize: 10, height: 20 }} />
                <Chip icon={<DescriptionRounded sx={{ fontSize: 12 }} />} label="TXT" size="small" variant="outlined" sx={{ fontSize: 10, height: 20 }} />
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────────────────────────────────────

export const AnalyzerPage: React.FC = () => {
  const theme   = useTheme();
  const isDark  = theme.palette.mode === 'dark';
  const dispatch = useAppDispatch();
  const { current, status, isTriggering } = useAppSelector((s) => s.analysis);
  const activeProjectId = useAppSelector((s) => s.ui.activeProjectId);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [title,     setTitle]     = useState('');
  const [body,      setBody]      = useState('');
  const [type,      setType]      = useState<RequirementType>('FUNCTIONAL');
  const [priority,  setPriority]  = useState<RequirementPriority>('MEDIUM');
  const [context,   setContext]   = useState('');
  const [techStack, setTechStack] = useState('');
  const [domain,    setDomain]    = useState('');
  const [showMore,  setShowMore]  = useState(false);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [isExportingPdf,  setIsExportingPdf]  = useState(false);
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [analysisId, setAnalysisId] = useState<string | null>(null);

  // ── Polling ────────────────────────────────────────────────────────────────
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingMs  = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }, []);

  const startPolling = useCallback((requirementId: string) => {
    pollingMs.current = 0;
    stopPolling();
    pollingRef.current = setInterval(async () => {
      pollingMs.current += config.pollingInterval;
      const result = await dispatch(pollAnalysisStatusThunk({ projectId: activeProjectId, requirementId }));
      const s = (result.payload as any)?.status;
      if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(s) || pollingMs.current >= config.maxPollingTime) {
        stopPolling();
        if (s === 'COMPLETED') {
          dispatch(fetchAnalysisThunk({ projectId: activeProjectId, requirementId }));
          dispatch(showNotification({ message: '✓ Analysis complete — artifacts ready', severity: 'success' }));
        } else if (s === 'FAILED') {
          dispatch(showNotification({ message: 'Analysis failed. Please try again.', severity: 'error' }));
        }
      }
    }, config.pollingInterval);
  }, [dispatch, activeProjectId, stopPolling]);

  React.useEffect(() => () => stopPolling(), [stopPolling]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!title.trim() || !body.trim()) return;
    dispatch(clearCurrent());
    setActiveTab(0);
    setAnalysisId(null);

    const createResult = await dispatch(createRequirementThunk({
      projectId: activeProjectId,
      dto: { title, body, type, priority },
    }));
    if (createRequirementThunk.rejected.match(createResult)) {
      dispatch(showNotification({ message: 'Failed to save requirement', severity: 'error' }));
      return;
    }
    const requirementId = (createResult.payload as any).id;

    const triggerResult = await dispatch(triggerAnalysisThunk({
      projectId: activeProjectId,
      requirementId,
      context:   context.trim() || undefined,
      techStack: techStack.trim() || undefined,
      domain:    domain.trim()    || undefined,
    }));
    if (triggerAnalysisThunk.rejected.match(triggerResult)) {
      dispatch(showNotification({ message: 'Failed to start analysis', severity: 'error' }));
      return;
    }
    const aId = (triggerResult.payload as any)?.analysisId;
    if (aId) setAnalysisId(aId);
    dispatch(showNotification({ message: 'AI analysis queued — processing', severity: 'info' }));
    startPolling(requirementId);
  };

  // ── Export helpers ─────────────────────────────────────────────────────────
  const handleExport = async (format: 'pdf' | 'markdown') => {
    const id = analysisId ?? current?.id;
    if (!id) return;
    const setter = format === 'pdf' ? setIsExportingPdf : setIsExportingWord;
    setter(true);
    try {
      const response = await apiClient.get(`/export/${id}/${format}`, {
        responseType: format === 'pdf' ? 'blob' : 'text',
      });
      const ext      = format === 'pdf' ? 'pdf' : 'md';
      const mimeType = format === 'pdf' ? 'application/pdf' : 'text/markdown';
      const blob     = new Blob([response.data as BlobPart], { type: mimeType });
      const url      = URL.createObjectURL(blob);
      const link     = document.createElement('a');
      link.href      = url;
      link.download  = `reqai-analysis-${id.slice(0, 8)}.${ext}`;
      link.click();
      URL.revokeObjectURL(url);
      dispatch(showNotification({ message: `${format.toUpperCase()} exported successfully`, severity: 'success' }));
    } catch {
      dispatch(showNotification({ message: `Export failed — try again`, severity: 'error' }));
    } finally {
      setter(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const isInProgress  = !!status && ['QUEUED', 'PROCESSING'].includes(status.status);
  const wordCount     = body.split(/\s+/).filter(Boolean).length;
  const estTokens     = Math.ceil(body.length / 4);
  const canAnalyze    = !isTriggering && title.trim().length > 0 && body.trim().length > 0;

  // Map RESULT_TABS to artifacts from current analysis
  const artifactMap   = React.useMemo(() => {
    if (!current) return {} as Record<string, Artifact>;
    return Object.fromEntries(current.artifacts.map((a) => [a.artifactType, a]));
  }, [current]);

  const activeTabDef  = RESULT_TABS[activeTab];
  const activeArtifact = activeTabDef ? (artifactMap[activeTabDef.id] ?? null) : null;

  // Stepper active step
  const stepperStep = !isTriggering && !isInProgress ? -1
    : isTriggering ? 1
    : status?.status === 'QUEUED' ? 1
    : status?.status === 'PROCESSING' ? 2
    : 4;

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1440, mx: 'auto' }}>
      <PageHeader
        title="AI Requirement Analyzer"
        subtitle="Paste requirements, upload a file, and transform text into structured development artifacts"
        icon={<PsychologyRounded />}
      />

      <Grid container spacing={3} alignItems="flex-start">

        {/* ──────────────────────────────────────────────────────────────────
            LEFT PANEL — Input
        ─────────────────────────────────────────────────────────────────── */}
        <Grid item xs={12} lg={5} xl={4}>
          <Box sx={{ position: { lg: 'sticky' }, top: { lg: 16 } }}>
            <Card elevation={0} sx={{ border: `1px solid ${theme.palette.divider}` }}>
              <CardContent sx={{ p: 3 }}>

                {/* Section header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                  <Box sx={{
                    width: 34, height: 34, borderRadius: '10px',
                    background: 'linear-gradient(135deg, #6C63FF 0%, #8A85FF 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <AIIcon sx={{ color: '#fff', fontSize: 18 }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight={700} lineHeight={1.1}>Requirement Input</Typography>
                    <Typography variant="caption" color="text.secondary">Text or file upload</Typography>
                  </Box>
                </Box>

                <Stack spacing={2.25}>

                  {/* Upload zone */}
                  <UploadZone onExtracted={(text, filename) => {
                    if (text) {
                      setBody((prev) => prev ? `${prev}\n\n---\n\n${text}` : text);
                      if (!title && filename) setTitle(filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
                      dispatch(showNotification({ message: 'File text extracted — review and edit if needed', severity: 'info' }));
                    }
                  }} />

                  <Divider>
                    <Typography variant="caption" color="text.disabled" sx={{ px: 1 }}>or type below</Typography>
                  </Divider>

                  {/* Title */}
                  <TextField
                    label="Requirement Title *"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    fullWidth
                    size="small"
                    placeholder="e.g. User authentication with OAuth2"
                    inputProps={{ maxLength: 200 }}
                    helperText={`${title.length}/200`}
                    FormHelperTextProps={{ sx: { textAlign: 'right', m: 0, mt: 0.25 } }}
                  />

                  {/* Type + Priority row */}
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <TextField
                      select label="Type" value={type}
                      onChange={(e) => setType(e.target.value as RequirementType)}
                      fullWidth size="small"
                    >
                      {(['FUNCTIONAL','NON_FUNCTIONAL','BUSINESS','TECHNICAL','UI_UX','SECURITY','PERFORMANCE','COMPLIANCE'] as const).map((t) => (
                        <MenuItem key={t} value={t}>{t.replace(/_/g, ' ')}</MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select label="Priority" value={priority}
                      onChange={(e) => setPriority(e.target.value as RequirementPriority)}
                      fullWidth size="small"
                    >
                      {(['CRITICAL','HIGH','MEDIUM','LOW'] as const).map((p) => (
                        <MenuItem key={p} value={p}>{p}</MenuItem>
                      ))}
                    </TextField>
                  </Box>

                  {/* Large body textarea */}
                  <Box sx={{ position: 'relative' }}>
                    <TextField
                      label="Requirement Body *"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      multiline
                      rows={12}
                      fullWidth
                      placeholder={`Describe the requirement in detail.\n\nInclude:\n• Business context and user goals\n• Acceptance rules and constraints\n• Performance or security expectations\n• Any technical considerations\n\nThe more detail you provide, the richer the AI output will be.`}
                      sx={{
                        '& .MuiInputBase-root': { alignItems: 'flex-start' },
                        '& textarea': { fontSize: '0.875rem', lineHeight: 1.7 },
                      }}
                    />
                    {body.length > 0 && (
                      <Typography variant="caption" color="text.disabled"
                        sx={{ position: 'absolute', bottom: 10, right: 14, pointerEvents: 'none' }}>
                        {wordCount} words · ~{estTokens} tokens
                      </Typography>
                    )}
                  </Box>

                  {/* Context */}
                  <TextField
                    label="Analyst Context (optional)"
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    multiline rows={2} fullWidth size="small"
                    placeholder="Background, constraints, or assumptions the AI should know…"
                  />

                  {/* Advanced: tech stack / domain */}
                  <Box>
                    <Button
                      size="small" variant="text"
                      onClick={() => setShowMore((v) => !v)}
                      endIcon={<ExpandMoreRounded sx={{ transform: showMore ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />}
                      sx={{ color: 'text.secondary', p: 0, minWidth: 0, textTransform: 'none', fontSize: 12 }}
                    >
                      {showMore ? 'Hide advanced options' : 'Advanced options (tech stack / domain)'}
                    </Button>
                    {showMore && (
                      <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                        <TextField
                          label="Technology Stack"
                          value={techStack}
                          onChange={(e) => setTechStack(e.target.value)}
                          fullWidth size="small"
                          placeholder="e.g. Node.js, PostgreSQL, React 19, Redis"
                        />
                        <TextField
                          label="Business Domain"
                          value={domain}
                          onChange={(e) => setDomain(e.target.value)}
                          fullWidth size="small"
                          placeholder="e.g. fintech, healthcare, e-commerce"
                        />
                      </Stack>
                    )}
                  </Box>

                  {/* Analyze button */}
                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={!canAnalyze}
                    onClick={handleAnalyze}
                    startIcon={isTriggering
                      ? <CircularProgress size={18} color="inherit" />
                      : <AIIcon />}
                    endIcon={!isTriggering && <SendRounded sx={{ fontSize: 18 }} />}
                    sx={{ py: 1.5, fontWeight: 700, fontSize: '0.9375rem', letterSpacing: 0.25 }}
                  >
                    {isTriggering ? 'Queuing analysis…' : 'Analyze with AI'}
                  </Button>

                  {/* Reset button (shown when there is a result) */}
                  {current && (
                    <Button
                      variant="outlined" size="medium" fullWidth color="inherit"
                      startIcon={<RefreshRounded />}
                      onClick={() => {
                        dispatch(clearCurrent());
                        setTitle(''); setBody(''); setContext(''); setTechStack(''); setDomain('');
                        setActiveTab(0); setAnalysisId(null);
                      }}
                      sx={{ fontWeight: 600, color: 'text.secondary' }}
                    >
                      New Analysis
                    </Button>
                  )}
                </Stack>

                {/* AI provider chip */}
                <Box sx={{
                  mt: 2.5, p: 1.5, borderRadius: 2,
                  background: isDark ? 'rgba(108,99,255,0.1)' : 'rgba(108,99,255,0.06)',
                  display: 'flex', alignItems: 'center', gap: 1,
                }}>
                  <AIIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                  <Typography variant="caption" color="text.secondary">
                    Powered by OpenAI GPT-4o · 8 artifact types displayed · PromptBuilder v2
                  </Typography>
                </Box>

              </CardContent>
            </Card>
          </Box>
        </Grid>

        {/* ──────────────────────────────────────────────────────────────────
            RIGHT PANEL — Results
        ─────────────────────────────────────────────────────────────────── */}
        <Grid item xs={12} lg={7} xl={8}>

          {/* ── Loading / progress ───────────────────────────────────────── */}
          {(isTriggering || isInProgress) && (
            <Card elevation={0} sx={{ mb: 2.5, border: `1px solid ${theme.palette.divider}` }}>
              <CardContent sx={{ p: 3 }}>
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                  <HourglassEmptyRounded sx={{
                    color: 'warning.main', fontSize: 22,
                    animation: 'spin 2s linear infinite',
                    '@keyframes spin': { '100%': { transform: 'rotate(360deg)' } },
                  }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {status?.message ?? 'Preparing analysis…'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      AI is analyzing your requirement — please wait
                    </Typography>
                  </Box>
                  {status && <AnalysisStatusChip status={status.status} />}
                </Box>

                {/* Progress bar */}
                {status && (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                      <Typography variant="caption" color="text.secondary">Overall progress</Typography>
                      <Typography variant="caption" color="primary.main" fontWeight={700}>
                        {status.progress}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={status.progress}
                      sx={{ height: 10, borderRadius: 5, mb: 2.5 }}
                    />
                  </>
                )}

                {/* Step indicator */}
                <Stepper activeStep={stepperStep} orientation="vertical" sx={{ mt: 0 }}>
                  {ANALYSIS_STEPS.map((step, i) => (
                    <Step key={step.label} completed={stepperStep > i}>
                      <StepLabel
                        StepIconProps={{ sx: { fontSize: 18 } }}
                        sx={{ '& .MuiStepLabel-label': { fontSize: 13, fontWeight: stepperStep === i ? 700 : 400 } }}
                      >
                        {step.label}
                      </StepLabel>
                      <StepContent>
                        <Typography variant="caption" color="text.secondary">{step.desc}</Typography>
                      </StepContent>
                    </Step>
                  ))}
                </Stepper>
              </CardContent>
            </Card>
          )}

          {/* ── Completed analysis — results panel ──────────────────────── */}
          {current && current.status === 'COMPLETED' && (
            <>
              {/* Result header bar */}
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, mb: 2,
                flexWrap: 'wrap',
              }}>
                <CheckCircleRounded sx={{ color: 'success.main', fontSize: 22, flexShrink: 0 }} />
                <Typography variant="h6" fontWeight={700}>Analysis Complete</Typography>
                <Chip
                  label={`${Object.keys(artifactMap).length} / ${RESULT_TABS.length} artifacts`}
                  size="small"
                  color={Object.keys(artifactMap).length >= RESULT_TABS.length ? 'success' : 'warning'}
                />
                <Box sx={{ flex: 1 }} />

                {/* Export buttons */}
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={isExportingPdf ? <CircularProgress size={14} /> : <PictureAsPdfRounded sx={{ fontSize: 16 }} />}
                  disabled={isExportingPdf}
                  onClick={() => handleExport('pdf')}
                  sx={{ fontWeight: 600, textTransform: 'none' }}
                >
                  Export PDF
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={isExportingWord ? <CircularProgress size={14} /> : <ArticleRounded sx={{ fontSize: 16 }} />}
                  disabled={isExportingWord}
                  onClick={() => handleExport('markdown')}
                  sx={{ fontWeight: 600, textTransform: 'none' }}
                >
                  Export Word
                </Button>

                {/* Save + Reset */}
                <Tooltip title="Save to library">
                  <IconButton size="small" onClick={() => {
                    dispatch(saveAnalysisThunk({ projectId: activeProjectId, requirementId: current.requirementId }));
                    dispatch(showNotification({ message: 'Saved to library', severity: 'success' }));
                  }}>
                    <BookmarkAddRounded fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              {/* ── Result Tabs ─────────────────────────────────────────── */}
              <Card elevation={0} sx={{ border: `1px solid ${theme.palette.divider}` }}>
                {/* Tab bar */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <Tabs
                    value={activeTab}
                    onChange={(_, v) => setActiveTab(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                    allowScrollButtonsMobile
                    sx={{ minHeight: 48, '& .MuiTab-root': { minHeight: 48 } }}
                  >
                    {RESULT_TABS.map((t, i) => {
                      const hasArtifact = !!artifactMap[t.id];
                      return (
                        <Tab
                          key={t.id}
                          disabled={!hasArtifact}
                          label={
                            <Badge
                              variant="dot"
                              color="success"
                              invisible={!hasArtifact}
                              sx={{ '& .MuiBadge-badge': { top: -2, right: -2 } }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Box sx={{ color: activeTab === i ? t.color : 'inherit' }}>{t.icon}</Box>
                                <Typography variant="caption" fontWeight={activeTab === i ? 700 : 500}>
                                  {t.label}
                                </Typography>
                              </Box>
                            </Badge>
                          }
                          sx={{
                            textTransform: 'none',
                            minWidth: 'fit-content',
                            px: 1.75,
                            opacity: hasArtifact ? 1 : 0.4,
                            '&.Mui-selected': { color: 'text.primary' },
                          }}
                        />
                      );
                    })}
                  </Tabs>
                </Box>

                {/* Tab content */}
                <CardContent sx={{ p: 2.5, minHeight: 320 }}>
                  {/* Tab description + confidence + copy */}
                  {activeTabDef && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                          <Box sx={{ color: activeTabDef.color }}>{activeTabDef.icon}</Box>
                          <Typography variant="subtitle1" fontWeight={700}>{activeTabDef.label}</Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">{activeTabDef.desc}</Typography>
                      </Box>
                      {activeArtifact?.confidenceScore != null && (
                        <Chip
                          label={`${(activeArtifact.confidenceScore * 100).toFixed(0)}% confidence`}
                          size="small"
                          color={activeArtifact.confidenceScore >= 0.8 ? 'success' : activeArtifact.confidenceScore >= 0.6 ? 'warning' : 'error'}
                          variant="outlined"
                        />
                      )}
                      {activeArtifact && (
                        <>
                          <Rating
                            size="small"
                            value={activeArtifact.userRating ?? 0}
                            onChange={(_, v) => v && dispatch(rateArtifactThunk({ artifactId: activeArtifact.id, rating: v }))}
                          />
                          <Tooltip title="Copy JSON">
                            <IconButton size="small" onClick={() => {
                              navigator.clipboard.writeText(JSON.stringify(activeArtifact.content, null, 2));
                              dispatch(showNotification({ message: 'Copied to clipboard', severity: 'success' }));
                            }}>
                              <ContentCopyRounded sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Box>
                  )}

                  <Divider sx={{ mb: 2.5 }} />

                  {/* Rendered artifact */}
                  {activeTabDef && (
                    <ArtifactTabContent tabId={activeTabDef.id} artifact={activeArtifact} />
                  )}
                </CardContent>
              </Card>

              {/* Analysis metadata footer */}
              <Box sx={{
                mt: 1.5, p: 1.75,
                borderRadius: 2,
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                border: `1px solid ${theme.palette.divider}`,
                display: 'flex', flexWrap: 'wrap', gap: 2.5,
              }}>
                {[
                  ['Provider',  current.aiProvider],
                  ['Model',     current.aiModel],
                  ['Version',   current.promptVersion],
                  ['Tokens',    current.tokensTotal?.toLocaleString() ?? '—'],
                  ['Cost',      current.costUsd != null ? `$${Number(current.costUsd).toFixed(6)}` : '—'],
                  ['Duration',  `${((current.durationMs ?? 0) / 1000).toFixed(1)}s`],
                ].map(([k, v]) => (
                  <Box key={k}>
                    <Typography variant="caption" color="text.disabled" display="block" lineHeight={1.2}>{k}</Typography>
                    <Typography variant="caption" fontWeight={700} fontFamily="monospace">{v}</Typography>
                  </Box>
                ))}

                {/* Export from footer */}
                <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Button
                    size="small" variant="text"
                    startIcon={<FileDownloadRounded sx={{ fontSize: 16 }} />}
                    disabled={isExportingPdf}
                    onClick={() => handleExport('pdf')}
                    sx={{ fontSize: 12, textTransform: 'none', color: 'text.secondary' }}
                  >
                    {isExportingPdf ? 'Exporting…' : 'PDF'}
                  </Button>
                  <Button
                    size="small" variant="text"
                    startIcon={<DownloadRounded sx={{ fontSize: 16 }} />}
                    disabled={isExportingWord}
                    onClick={() => handleExport('markdown')}
                    sx={{ fontSize: 12, textTransform: 'none', color: 'text.secondary' }}
                  >
                    {isExportingWord ? 'Exporting…' : 'Markdown'}
                  </Button>
                </Box>
              </Box>
            </>
          )}

          {/* ── Failed state ─────────────────────────────────────────────── */}
          {current && current.status === 'FAILED' && (
            <Alert severity="error" icon={<ErrorRounded />} sx={{ borderRadius: 2 }}>
              <Typography fontWeight={700} gutterBottom>Analysis failed</Typography>
              <Typography variant="body2">
                {current.errorMessage ?? 'An unexpected error occurred. Please try again.'}
              </Typography>
            </Alert>
          )}

          {/* ── Empty state ───────────────────────────────────────────────── */}
          {!current && !isInProgress && !isTriggering && (
            <Box sx={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', textAlign: 'center',
              py: 10, px: 3,
              background: isDark
                ? 'radial-gradient(ellipse at center, rgba(108,99,255,0.08) 0%, transparent 70%)'
                : 'radial-gradient(ellipse at center, rgba(108,99,255,0.05) 0%, transparent 70%)',
              borderRadius: 3,
              border: `1px dashed ${alpha(theme.palette.primary.main, 0.25)}`,
            }}>
              {/* Icon */}
              <Box sx={{
                width: 88, height: 88, borderRadius: '28px', mb: 3,
                background: `linear-gradient(135deg, ${alpha('#6C63FF', 0.15)}, ${alpha('#8A85FF', 0.08)})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${alpha('#6C63FF', 0.2)}`,
              }}>
                <PsychologyRounded sx={{ fontSize: 44, color: 'primary.main', opacity: 0.8 }} />
              </Box>

              <Typography variant="h5" fontWeight={700} gutterBottom>Ready to Analyze</Typography>
              <Typography variant="body2" color="text.secondary" mb={3} maxWidth={400}>
                Enter or upload your requirements on the left, then click{' '}
                <strong>"Analyze with AI"</strong> to generate structured artifacts.
              </Typography>

              {/* Available tabs preview */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 0.75 }}>
                {RESULT_TABS.map((t) => (
                  <Chip
                    key={t.id}
                    icon={<Box sx={{ color: `${t.color} !important`, display: 'flex' }}>{t.icon}</Box>}
                    label={t.label}
                    size="small"
                    variant="outlined"
                    sx={{ borderColor: alpha(t.color, 0.3), fontSize: 11 }}
                  />
                ))}
              </Box>
            </Box>
          )}

        </Grid>
      </Grid>
    </Box>
  );
};
