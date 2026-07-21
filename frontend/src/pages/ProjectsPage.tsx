import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Button, Card, CardContent, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, Grid, IconButton, InputAdornment,
  LinearProgress, MenuItem, Skeleton, Stack, TextField, Tooltip,
  Typography, alpha, useTheme, CircularProgress, Alert,
  Select, FormControl, InputLabel,
} from '@mui/material';
import {
  AddRounded,
  FolderRounded,
  SearchRounded,
  EditRounded,
  ArchiveRounded,
  UnarchiveRounded,
  ArrowForwardRounded,
  RefreshRounded,
  FilterListRounded,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  fetchProjectsThunk,
  createProjectThunk,
  updateProjectThunk,
  clearError,
  type CreateProjectDto,
  type UpdateProjectDto,
  type ProjectQuery,
} from '../features/projects/projectSlice';
import { showNotification } from '../features/notifications/notificationSlice';
import { PageHeader } from '../components/shared/PageHeader';
import { Project } from '../types';

// ── Status config ─────────────────────────────────────────────────────────────

type StatusFilter = Project['status'] | 'ALL';

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL',      label: 'All statuses' },
  { value: 'ACTIVE',   label: 'Active'       },
  { value: 'ARCHIVED', label: 'Archived'     },
  { value: 'ON_HOLD',  label: 'On hold'      },
];

function statusChip(status: Project['status']) {
  const map: Record<Project['status'], { label: string; color: 'success' | 'default' | 'warning' }> = {
    ACTIVE:   { label: 'Active',    color: 'success' },
    ARCHIVED: { label: 'Archived',  color: 'default' },
    ON_HOLD:  { label: 'On Hold',   color: 'warning' },
  };
  const { label, color } = map[status] ?? { label: status, color: 'default' };
  return <Chip label={label} color={color} size="small" />;
}

// ── Create / Edit Dialog ──────────────────────────────────────────────────────

interface ProjectDialogProps {
  open:      boolean;
  project?:  Project | null;
  onClose:   () => void;
  onSubmit:  (dto: CreateProjectDto | UpdateProjectDto) => void;
  isSaving:  boolean;
}

const ProjectDialog: React.FC<ProjectDialogProps> = ({ open, project, onClose, onSubmit, isSaving }) => {
  const isEdit = Boolean(project);
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus]           = useState<Project['status']>('ACTIVE');

  useEffect(() => {
    if (open) {
      setName(project?.name ?? '');
      setDescription(project?.description ?? '');
      setStatus(project?.status ?? 'ACTIVE');
    }
  }, [open, project]);

  const canSubmit = name.trim().length >= 2;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const dto: CreateProjectDto | UpdateProjectDto = {
      name: name.trim(),
      description: description.trim() || undefined,
      ...(isEdit && { status }),
    };
    onSubmit(dto);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {isEdit ? 'Edit project' : 'New project'}
      </DialogTitle>

      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2.5}>
            <TextField
              label="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              autoFocus
              inputProps={{ maxLength: 120 }}
              helperText={`${name.length}/120 — minimum 2 characters`}
              error={name.length > 0 && name.trim().length < 2}
            />

            <TextField
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              minRows={3}
              fullWidth
              inputProps={{ maxLength: 500 }}
              helperText={`${description.length}/500`}
            />

            {isEdit && (
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={status}
                  label="Status"
                  onChange={(e) => setStatus(e.target.value as Project['status'])}
                >
                  <MenuItem value="ACTIVE">Active</MenuItem>
                  <MenuItem value="ON_HOLD">On Hold</MenuItem>
                  <MenuItem value="ARCHIVED">Archived</MenuItem>
                </Select>
              </FormControl>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose} disabled={isSaving} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!canSubmit || isSaving}
            endIcon={isSaving ? <CircularProgress size={14} color="inherit" /> : undefined}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Create project'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

// ── Project Card ──────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project:   Project;
  onEdit:    (p: Project) => void;
  onArchive: (p: Project) => void;
  onOpen:    (p: Project) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onEdit, onArchive, onOpen }) => {
  const theme  = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const pct    = project.requirementCount > 0 ? Math.min(100, project.requirementCount * 10) : 0;

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <CardContent sx={{ flex: 1, p: 2.5 }}>
        {/* Header row */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
          <Box sx={{
            width: 40, height: 40, borderRadius: 2, flexShrink: 0,
            bgcolor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.1),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FolderRounded sx={{ color: 'primary.main', fontSize: 22 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              {project.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Created {new Date(project.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </Typography>
          </Box>
          {statusChip(project.status)}
        </Box>

        {/* Description */}
        {project.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 2, overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}
          >
            {project.description}
          </Typography>
        )}

        {/* Stats */}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight={700} lineHeight={1}>{project.requirementCount}</Typography>
            <Typography variant="caption" color="text.secondary">Requirements</Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="h6" fontWeight={700} lineHeight={1}>{project.memberCount}</Typography>
            <Typography variant="caption" color="text.secondary">Members</Typography>
          </Box>
        </Stack>

        {/* Fake progress bar based on requirement count */}
        <Box sx={{ mb: 0.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">Activity</Typography>
            <Typography variant="caption" color="text.secondary">{pct}%</Typography>
          </Box>
          <LinearProgress variant="determinate" value={pct} sx={{ height: 4, borderRadius: 2 }} />
        </Box>
      </CardContent>

      <Divider />

      <Box sx={{ px: 2, py: 1.25, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Edit project" arrow>
            <IconButton size="small" onClick={() => onEdit(project)}>
              <EditRounded fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={project.status === 'ARCHIVED' ? 'Unarchive' : 'Archive'} arrow>
            <IconButton size="small" onClick={() => onArchive(project)} color="warning">
              {project.status === 'ARCHIVED'
                ? <UnarchiveRounded fontSize="small" />
                : <ArchiveRounded fontSize="small" />
              }
            </IconButton>
          </Tooltip>
        </Stack>

        <Button
          size="small"
          endIcon={<ArrowForwardRounded fontSize="small" />}
          onClick={() => onOpen(project)}
          disabled={project.status === 'ARCHIVED'}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          Open
        </Button>
      </Box>
    </Card>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { items, total, isLoading, isSaving, error } = useAppSelector((s) => s.projects);

  const [search,        setSearch]        = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>('ALL');
  const [page,          setPage]          = useState(1);

  const [dialogOpen,    setDialogOpen]    = useState(false);
  const [editTarget,    setEditTarget]    = useState<Project | null>(null);

  // Debounce search by 350ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    const query: ProjectQuery = {
      page,
      limit: 12,
      ...(statusFilter !== 'ALL' && { status: statusFilter }),
      ...(debouncedSearch && { search: debouncedSearch }),
    };
    dispatch(fetchProjectsThunk(query));
  }, [dispatch, page, statusFilter, debouncedSearch]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { dispatch(clearError()); }, [dispatch, statusFilter, debouncedSearch]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDialogSubmit = async (dto: CreateProjectDto | UpdateProjectDto) => {
    if (editTarget) {
      const result = await dispatch(updateProjectThunk({ id: editTarget.id, dto }));
      if (updateProjectThunk.fulfilled.match(result)) {
        dispatch(showNotification({ message: 'Project updated', severity: 'success' }));
        setEditTarget(null);
        setDialogOpen(false);
      } else {
        dispatch(showNotification({ message: result.payload as string, severity: 'error' }));
      }
    } else {
      const createDto = dto as CreateProjectDto;
      const result = await dispatch(createProjectThunk(createDto));
      if (createProjectThunk.fulfilled.match(result)) {
        dispatch(showNotification({ message: `Project "${result.payload.name}" created`, severity: 'success' }));
        setDialogOpen(false);
      } else {
        dispatch(showNotification({ message: result.payload as string, severity: 'error' }));
      }
    }
  };

  const handleArchiveToggle = async (project: Project) => {
    const nextStatus = project.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED';
    const result = await dispatch(updateProjectThunk({ id: project.id, dto: { status: nextStatus } }));
    if (updateProjectThunk.fulfilled.match(result)) {
      dispatch(showNotification({
        message:  `Project ${nextStatus === 'ARCHIVED' ? 'archived' : 'restored'}`,
        severity: 'success',
      }));
    }
  };

  const totalPages = Math.ceil(total / 12);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400 }}>
      <PageHeader
        title="Projects"
        subtitle="Manage your AI analysis projects and their requirements"
        icon={<FolderRounded />}
        action={
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            onClick={() => { setEditTarget(null); setDialogOpen(true); }}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            New project
          </Button>
        }
      />

      {/* Error alert */}
      {error && (
        <Alert severity="error" onClose={() => dispatch(clearError())} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Filters toolbar */}
      <Card variant="outlined" sx={{ mb: 2.5, p: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} flexWrap="wrap" useFlexGap>
          <TextField
            size="small"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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
            onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
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

          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            <Box component="span" fontWeight={700}>{total}</Box> total
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
        </Stack>
      </Card>

      {/* Project cards grid */}
      {isLoading ? (
        <Grid container spacing={2.5}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Grid item xs={12} sm={6} lg={4} key={i}>
              <Skeleton height={260} variant="rounded" sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      ) : items.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 10 }}>
          <FolderRounded sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {debouncedSearch || statusFilter !== 'ALL' ? 'No projects match your filters' : 'No projects yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            {!debouncedSearch && statusFilter === 'ALL' && 'Create your first project to start analyzing requirements with AI'}
          </Typography>
          {!debouncedSearch && statusFilter === 'ALL' && (
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => { setEditTarget(null); setDialogOpen(true); }}
            >
              Create first project
            </Button>
          )}
        </Box>
      ) : (
        <Grid container spacing={2.5}>
          {items.map((project) => (
            <Grid item xs={12} sm={6} lg={4} key={project.id}>
              <ProjectCard
                project={project}
                onEdit={(p)    => { setEditTarget(p); setDialogOpen(true); }}
                onArchive={(p) => handleArchiveToggle(p)}
                onOpen={(p)    => navigate(`/projects/${p.id}/requirements`)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 1 }}>
          <Button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            variant="outlined"
            size="small"
          >
            Previous
          </Button>
          <Typography variant="body2" sx={{ alignSelf: 'center' }}>
            Page {page} of {totalPages}
          </Typography>
          <Button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            variant="outlined"
            size="small"
          >
            Next
          </Button>
        </Box>
      )}

      {/* Create / Edit Dialog */}
      <ProjectDialog
        open={dialogOpen}
        project={editTarget}
        onClose={() => { setDialogOpen(false); setEditTarget(null); }}
        onSubmit={handleDialogSubmit}
        isSaving={isSaving}
      />
    </Box>
  );
};
