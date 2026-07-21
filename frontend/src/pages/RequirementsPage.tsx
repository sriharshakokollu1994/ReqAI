import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogContentText, DialogTitle, Divider, Drawer,
  FormControl, IconButton, InputAdornment, InputLabel, MenuItem,
  Select, Skeleton, Stack, Table, TableBody, TableCell,
  TableHead, TablePagination, TableRow, TextField, Tooltip,
  Typography, Alert, useTheme,
} from '@mui/material';
import {
  AddRounded,
  SearchRounded,
  FilterListRounded,
  PsychologyRounded as AnalyzeIcon,
  EditRounded,
  DeleteRounded,
  ArrowBackRounded,
  AssignmentRounded,
  CloseRounded,
  SaveRounded,
  RefreshRounded,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  fetchRequirementsThunk,
  createRequirementThunk,
  updateRequirementThunk,
  deleteRequirementThunk,
  clearError as clearReqError,
  type CreateRequirementDto,
  type UpdateRequirementDto,
  type RequirementQuery,
} from '../features/requirements/requirementSlice';
import { fetchProjectThunk } from '../features/projects/projectSlice';
import { triggerAnalysisThunk } from '../features/analysis/analysisSlice';
import { showNotification } from '../features/notifications/notificationSlice';
import { PageHeader } from '../components/shared/PageHeader';
import {
  Requirement, RequirementType, RequirementPriority, RequirementStatus,
} from '../types';
import { format } from 'date-fns';

// ── Constants ─────────────────────────────────────────────────────────────────

const REQ_TYPES: RequirementType[] = [
  'FUNCTIONAL', 'NON_FUNCTIONAL', 'BUSINESS', 'TECHNICAL',
  'UI_UX', 'SECURITY', 'PERFORMANCE', 'COMPLIANCE',
];

const REQ_PRIORITIES: RequirementPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const PRIORITY_COLOR: Record<RequirementPriority, 'error' | 'warning' | 'info' | 'success'> = {
  CRITICAL: 'error',
  HIGH:     'warning',
  MEDIUM:   'info',
  LOW:      'success',
};

const STATUS_OPTIONS: Array<{ value: RequirementStatus | 'ALL'; label: string }> = [
  { value: 'ALL',           label: 'All statuses'  },
  { value: 'DRAFT',         label: 'Draft'          },
  { value: 'UNDER_REVIEW',  label: 'Under Review'   },
  { value: 'APPROVED',      label: 'Approved'       },
  { value: 'ANALYZING',     label: 'Analyzing'      },
  { value: 'ANALYZED',      label: 'Analyzed'       },
  { value: 'REJECTED',      label: 'Rejected'       },
  { value: 'ARCHIVED',      label: 'Archived'       },
];

function typeLabel(t: RequirementType): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Requirement Drawer ────────────────────────────────────────────────────────

interface ReqDrawerProps {
  open:         boolean;
  projectId:    string;
  requirement?: Requirement | null;
  onClose:      () => void;
  isSaving:     boolean;
}

const RequirementDrawer: React.FC<ReqDrawerProps> = ({
  open, projectId, requirement, onClose, isSaving,
}) => {
  const dispatch = useAppDispatch();
  const isEdit   = Boolean(requirement);

  const [title,     setTitle]     = useState('');
  const [body,      setBody]      = useState('');
  const [type,      setType]      = useState<RequirementType>('FUNCTIONAL');
  const [priority,  setPriority]  = useState<RequirementPriority>('MEDIUM');
  const [status,    setStatus]    = useState<RequirementStatus>('DRAFT');
  const [source,    setSource]    = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(requirement?.title ?? '');
      setBody(requirement?.body ?? '');
      setType(requirement?.type ?? 'FUNCTIONAL');
      setPriority(requirement?.priority ?? 'MEDIUM');
      setStatus(requirement?.status ?? 'DRAFT');
      setSource(requirement?.source ?? '');
      setTagsInput(requirement?.tags?.join(', ') ?? '');
      setError(null);
    }
  }, [open, requirement]);

  const canSubmit  = title.trim().length >= 3 && body.trim().length >= 10;
  const parseTags  = (input: string): string[] =>
    input.split(',').map((t) => t.trim()).filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);

    const dto: CreateRequirementDto = {
      title:    title.trim(),
      body:     body.trim(),
      type,
      priority,
      tags:     parseTags(tagsInput),
      source:   source.trim() || undefined,
    };

    if (isEdit && requirement) {
      const updateDto: UpdateRequirementDto = { ...dto, status };
      const result = await dispatch(updateRequirementThunk({ projectId, id: requirement.id, dto: updateDto }));
      if (updateRequirementThunk.fulfilled.match(result)) {
        dispatch(showNotification({ message: 'Requirement updated', severity: 'success' }));
        onClose();
      } else {
        setError(result.payload as string);
      }
    } else {
      const result = await dispatch(createRequirementThunk({ projectId, dto }));
      if (createRequirementThunk.fulfilled.match(result)) {
        dispatch(showNotification({ message: 'Requirement created', severity: 'success' }));
        onClose();
      } else {
        setError(result.payload as string);
      }
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 520 } } }}
    >
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{
          px: 3, py: 2.5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: 1, borderColor: 'divider',
        }}>
          <Typography variant="h6" fontWeight={700}>
            {isEdit ? 'Edit requirement' : 'New requirement'}
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseRounded fontSize="small" />
          </IconButton>
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Stack spacing={2.5}>
            <TextField
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              fullWidth
              autoFocus
              inputProps={{ maxLength: 255 }}
              helperText={`${title.length}/255 — minimum 3 characters`}
              error={title.length > 0 && title.trim().length < 3}
            />

            <TextField
              label="Requirement body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              fullWidth
              multiline
              minRows={6}
              maxRows={16}
              inputProps={{ maxLength: 50000 }}
              helperText="Describe the requirement in detail. More context = better AI output."
            />

            <Stack direction="row" spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select
                  value={type}
                  label="Type"
                  onChange={(e) => setType(e.target.value as RequirementType)}
                >
                  {REQ_TYPES.map((t) => (
                    <MenuItem key={t} value={t}>{typeLabel(t)}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel>Priority</InputLabel>
                <Select
                  value={priority}
                  label="Priority"
                  onChange={(e) => setPriority(e.target.value as RequirementPriority)}
                >
                  {REQ_PRIORITIES.map((p) => (
                    <MenuItem key={p} value={p}>{p}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            {isEdit && (
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={status}
                  label="Status"
                  onChange={(e) => setStatus(e.target.value as RequirementStatus)}
                >
                  {STATUS_OPTIONS.filter((o) => o.value !== 'ALL').map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <TextField
              label="Source / reference (optional)"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              fullWidth
              size="small"
              placeholder="e.g. Jira-1234, Business Brief v2"
              inputProps={{ maxLength: 255 }}
            />

            <TextField
              label="Tags (comma-separated)"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              fullWidth
              size="small"
              placeholder="e.g. auth, payment, mvp"
            />
          </Stack>
        </Box>

        {/* Footer */}
        <Box sx={{
          px: 3, py: 2, borderTop: 1, borderColor: 'divider',
          display: 'flex', gap: 1.5, justifyContent: 'flex-end',
        }}>
          <Button onClick={onClose} disabled={isSaving} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!canSubmit || isSaving}
            startIcon={isSaving ? <CircularProgress size={14} color="inherit" /> : <SaveRounded />}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Create requirement'}
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
};

// ── Delete Confirm Dialog ──────────────────────────────────────────────────────

interface DeleteDialogProps {
  req:       Requirement | null;
  projectId: string;
  onClose:   () => void;
}

const DeleteDialog: React.FC<DeleteDialogProps> = ({ req, projectId, onClose }) => {
  const dispatch       = useAppDispatch();
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    if (!req) return;
    setBusy(true);
    const result = await dispatch(deleteRequirementThunk({ projectId, id: req.id }));
    setBusy(false);
    if (deleteRequirementThunk.fulfilled.match(result)) {
      dispatch(showNotification({ message: 'Requirement deleted', severity: 'success' }));
    } else {
      dispatch(showNotification({ message: result.payload as string, severity: 'error' }));
    }
    onClose();
  };

  return (
    <Dialog open={Boolean(req)} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Delete requirement?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          This will permanently delete <strong>{req?.title}</strong>. This action cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          color="error"
          variant="contained"
          disabled={busy}
          endIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────

export const RequirementsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const theme    = useTheme();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { items, total, isLoading, isSaving, error } = useAppSelector((s) => s.requirements);
  const { selected: project }                         = useAppSelector((s) => s.projects);
  const { isTriggering }                              = useAppSelector((s) => s.analysis);

  const [page,            setPage]            = useState(0);
  const [rowsPerPage,     setRowsPerPage]     = useState(20);
  const [search,          setSearch]          = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter,    setStatusFilter]    = useState<RequirementStatus | 'ALL'>('ALL');
  const [drawerOpen,      setDrawerOpen]      = useState(false);
  const [editTarget,      setEditTarget]      = useState<Requirement | null>(null);
  const [deleteTarget,    setDeleteTarget]    = useState<Requirement | null>(null);
  const [triggeringId,    setTriggeringId]    = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    if (!projectId) return;
    const query: RequirementQuery = {
      page:  page + 1,
      limit: rowsPerPage,
      ...(statusFilter !== 'ALL' && { status: statusFilter }),
      ...(debouncedSearch && { search: debouncedSearch }),
    };
    dispatch(fetchRequirementsThunk({ projectId, query }));
  }, [dispatch, projectId, page, rowsPerPage, statusFilter, debouncedSearch]);

  useEffect(() => {
    if (projectId) dispatch(fetchProjectThunk(projectId));
  }, [dispatch, projectId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { dispatch(clearReqError()); }, [dispatch, statusFilter, debouncedSearch]);

  const handleTriggerAnalysis = async (req: Requirement) => {
    if (!projectId) return;
    setTriggeringId(req.id);
    const result = await dispatch(triggerAnalysisThunk({ projectId, requirementId: req.id }));
    setTriggeringId(null);
    if (triggerAnalysisThunk.fulfilled.match(result)) {
      dispatch(showNotification({ message: 'Analysis queued — redirecting to Analyzer', severity: 'success' }));
      navigate(`/analyzer?projectId=${projectId}&reqId=${req.id}`);
    } else {
      dispatch(showNotification({ message: result.payload as string, severity: 'error' }));
    }
  };

  const COLS = ['Title', 'Type', 'Priority', 'Status', 'Tags', 'Words', 'Created', ''];

  if (!projectId) return null;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400 }}>
      <PageHeader
        title={project?.name ?? 'Requirements'}
        subtitle={project?.description ?? 'Manage and analyze project requirements'}
        icon={<AssignmentRounded />}
        action={
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackRounded />}
              onClick={() => navigate('/projects')}
              sx={{ textTransform: 'none' }}
            >
              Projects
            </Button>
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => { setEditTarget(null); setDrawerOpen(true); }}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Add requirement
            </Button>
          </Stack>
        }
      />

      {error && (
        <Alert severity="error" onClose={() => dispatch(clearReqError())} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Filters toolbar */}
      <Card>
        <Box sx={{
          px: 2.5, py: 1.75,
          display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap',
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}>
          <TextField
            size="small"
            placeholder="Search requirements…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            sx={{ minWidth: 240 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded fontSize="small" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            select
            size="small"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as RequirementStatus | 'ALL'); setPage(0); }}
            sx={{ minWidth: 160 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <FilterListRounded fontSize="small" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
          >
            {STATUS_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>

          <Box sx={{ flex: 1 }} />

          <Typography variant="body2" color="text.secondary">
            <Box component="span" fontWeight={700}>{total}</Box> requirements
          </Typography>

          <Tooltip title="Refresh" arrow>
            <span>
              <IconButton size="small" onClick={load} disabled={isLoading}>
                {isLoading
                  ? <CircularProgress size={16} thickness={5} />
                  : <RefreshRounded fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        {/* Table */}
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {COLS.map((h) => (
                  <TableCell
                    key={h}
                    sx={{ fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.disabled' }}
                  >
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {COLS.map((_, j) => <TableCell key={j}><Skeleton height={18} /></TableCell>)}
                    </TableRow>
                  ))
                : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={COLS.length} sx={{ textAlign: 'center', py: 8 }}>
                        <Typography color="text.secondary">
                          {debouncedSearch || statusFilter !== 'ALL'
                            ? 'No requirements match your filters'
                            : 'No requirements yet — add one to get started'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )
                : items.map((req) => {
                    const isTriggeringThis = triggeringId === req.id;
                    return (
                      <TableRow key={req.id} hover>
                        {/* Title */}
                        <TableCell sx={{ maxWidth: 260 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>{req.title}</Typography>
                          {req.source && (
                            <Typography variant="caption" color="text.secondary" noWrap>{req.source}</Typography>
                          )}
                        </TableCell>

                        {/* Type */}
                        <TableCell>
                          <Chip
                            label={typeLabel(req.type)}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.68rem', fontWeight: 600 }}
                          />
                        </TableCell>

                        {/* Priority */}
                        <TableCell>
                          <Chip
                            label={req.priority}
                            color={PRIORITY_COLOR[req.priority]}
                            size="small"
                            sx={{ fontSize: '0.68rem', fontWeight: 700 }}
                          />
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Chip
                            label={req.status.replace(/_/g, ' ')}
                            size="small"
                            variant="outlined"
                            color={
                              req.status === 'ANALYZED'  ? 'success' :
                              req.status === 'ANALYZING' ? 'info'    :
                              req.status === 'APPROVED'  ? 'primary' :
                              req.status === 'REJECTED'  ? 'error'   :
                              'default'
                            }
                            sx={{ fontSize: '0.68rem', fontWeight: 600 }}
                          />
                        </TableCell>

                        {/* Tags */}
                        <TableCell sx={{ maxWidth: 160 }}>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {req.tags.slice(0, 3).map((t) => (
                              <Chip key={t} label={t} size="small" sx={{ fontSize: '0.65rem', height: 18 }} />
                            ))}
                            {req.tags.length > 3 && (
                              <Chip label={`+${req.tags.length - 3}`} size="small" sx={{ fontSize: '0.65rem', height: 18 }} />
                            )}
                          </Stack>
                        </TableCell>

                        {/* Word count */}
                        <TableCell>
                          <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                            {req.wordCount ?? '—'}
                          </Typography>
                        </TableCell>

                        {/* Created */}
                        <TableCell>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {format(new Date(req.createdAt), 'MMM d, yyyy')}
                          </Typography>
                        </TableCell>

                        {/* Actions */}
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <Tooltip title="Run AI analysis" arrow>
                            <span>
                              <IconButton
                                size="small"
                                color="primary"
                                disabled={isTriggeringThis || isTriggering || req.status === 'ANALYZING'}
                                onClick={() => handleTriggerAnalysis(req)}
                              >
                                {isTriggeringThis
                                  ? <CircularProgress size={16} thickness={5} />
                                  : <AnalyzeIcon fontSize="small" />}
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Edit" arrow>
                            <IconButton size="small" onClick={() => { setEditTarget(req); setDrawerOpen(true); }}>
                              <EditRounded fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete" arrow>
                            <IconButton size="small" color="error" onClick={() => setDeleteTarget(req)}>
                              <DeleteRounded fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
              }
            </TableBody>
          </Table>
        </Box>

        <Divider />
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50]}
          sx={{ '& .MuiTablePagination-toolbar': { minHeight: 52 } }}
        />
      </Card>

      {/* Create / Edit Drawer */}
      <RequirementDrawer
        open={drawerOpen}
        projectId={projectId}
        requirement={editTarget}
        onClose={() => { setDrawerOpen(false); setEditTarget(null); }}
        isSaving={isSaving}
      />

      {/* Delete Confirm */}
      <DeleteDialog
        req={deleteTarget}
        projectId={projectId}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
};
