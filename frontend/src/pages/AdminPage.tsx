import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, TextField, Select,
  MenuItem, FormControl, InputLabel, Chip, IconButton, Tooltip,
  Typography, Avatar, Stack, Switch, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions, Button,
  InputAdornment, CircularProgress, Alert, alpha, useTheme,
  Divider,
} from '@mui/material';
import {
  SearchRounded,
  DeleteRounded,
  AdminPanelSettingsRounded,
  RefreshRounded,
  PersonOffRounded,
  PersonRounded,
  LockRounded,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  fetchUsersThunk,
  changeUserRoleThunk,
  changeUserStatusThunk,
  deleteUserThunk,
  clearAdminError,
} from '../features/admin/adminSlice';
import { showNotification } from '../features/notifications/notificationSlice';
import { AdminUser, UserRole } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_ROLES: UserRole[] = [
  'ADMIN', 'PROJECT_MANAGER', 'ARCHITECT',
  'BUSINESS_ANALYST', 'DEVELOPER', 'QA_ENGINEER',
];

type RoleColor = 'error' | 'warning' | 'primary' | 'info' | 'success' | 'default';

const ROLE_CHIP_COLOR: Record<UserRole, RoleColor> = {
  ADMIN:            'error',
  PROJECT_MANAGER:  'warning',
  ARCHITECT:        'primary',
  BUSINESS_ANALYST: 'info',
  DEVELOPER:        'success',
  QA_ENGINEER:      'default',
};

const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN:            'Admin',
  PROJECT_MANAGER:  'Project Manager',
  ARCHITECT:        'Architect',
  BUSINESS_ANALYST: 'Business Analyst',
  DEVELOPER:        'Developer',
  QA_ENGINEER:      'QA Engineer',
};

// ─── Delete confirmation dialog ───────────────────────────────────────────────

interface DeleteDialogProps {
  user:      AdminUser | null;
  onConfirm: () => void;
  onCancel:  () => void;
}

const DeleteDialog: React.FC<DeleteDialogProps> = ({ user, onConfirm, onCancel }) => (
  <Dialog open={Boolean(user)} onClose={onCancel} maxWidth="xs" fullWidth>
    <DialogTitle sx={{ fontWeight: 700 }}>Delete user?</DialogTitle>
    <DialogContent>
      <DialogContentText>
        This will permanently deactivate{' '}
        <strong>{user?.firstName} {user?.lastName}</strong>{' '}
        ({user?.email}). This action cannot be undone.
      </DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={onCancel} sx={{ textTransform: 'none' }}>Cancel</Button>
      <Button onClick={onConfirm} color="error" variant="contained" sx={{ textTransform: 'none', fontWeight: 600 }}>
        Delete user
      </Button>
    </DialogActions>
  </Dialog>
);

// ─── Main page ────────────────────────────────────────────────────────────────

export const AdminPage: React.FC = () => {
  const theme    = useTheme();
  const dispatch = useAppDispatch();
  const { users, meta, isLoading, error, rowLoading } = useAppSelector((s) => s.admin);
  const currentUserId = useAppSelector((s) => s.auth.user?.id);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search,        setSearch]        = useState('');
  const [roleFilter,    setRoleFilter]    = useState<UserRole | ''>('');
  const [statusFilter,  setStatusFilter]  = useState<'' | 'true' | 'false'>('');
  const [page,          setPage]          = useState(0);   // MUI TablePagination is 0-indexed
  const [rowsPerPage,   setRowsPerPage]   = useState(20);

  // Delete confirm dialog
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  // Debounced search — 350 ms
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // ── Data load ─────────────────────────────────────────────────────────────
  const load = useCallback(() => {
    dispatch(fetchUsersThunk({
      page:     page + 1,
      limit:    rowsPerPage,
      ...(roleFilter           ? { role: roleFilter }               : {}),
      ...(statusFilter !== ''  ? { isActive: statusFilter === 'true' } : {}),
      ...(debouncedSearch      ? { search: debouncedSearch }        : {}),
    }));
  }, [dispatch, page, rowsPerPage, roleFilter, statusFilter, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  // Dismiss stale error when filters change
  useEffect(() => { dispatch(clearAdminError()); }, [roleFilter, statusFilter, debouncedSearch, dispatch]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleRoleChange = async (user: AdminUser, role: UserRole) => {
    const result = await dispatch(changeUserRoleThunk({ userId: user.id, role }));
    if (changeUserRoleThunk.fulfilled.match(result)) {
      dispatch(showNotification({
        message:  `${user.firstName}'s role updated to ${ROLE_LABEL[role]}`,
        severity: 'success',
      }));
    } else {
      dispatch(showNotification({ message: (result.payload as any)?.message ?? 'Role change failed', severity: 'error' }));
    }
  };

  const handleStatusToggle = async (user: AdminUser) => {
    const next   = !user.isActive;
    const result = await dispatch(changeUserStatusThunk({ userId: user.id, isActive: next }));
    if (changeUserStatusThunk.fulfilled.match(result)) {
      dispatch(showNotification({
        message:  `${user.firstName} ${next ? 'activated' : 'deactivated'}`,
        severity: 'success',
      }));
    } else {
      dispatch(showNotification({ message: 'Status update failed', severity: 'error' }));
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const { id, firstName, lastName } = deleteTarget;
    setDeleteTarget(null);
    const result = await dispatch(deleteUserThunk(id));
    if (deleteUserThunk.fulfilled.match(result)) {
      dispatch(showNotification({
        message:  `${firstName} ${lastName} deleted`,
        severity: 'success',
      }));
    } else {
      dispatch(showNotification({ message: result.payload as string, severity: 'error' }));
    }
  };

  const initials = (u: AdminUser) =>
    `${u.firstName[0] ?? '?'}${u.lastName[0] ?? ''}`.toUpperCase();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto' }}>

      {/* ── Page header ─────────────────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: 2,
            bgcolor: alpha(theme.palette.error.main, 0.12),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AdminPanelSettingsRounded sx={{ fontSize: 20, color: 'error.main' }} />
          </Box>
          <Typography variant="h5" fontWeight={800} letterSpacing="-0.01em">
            User Management
          </Typography>
          <Chip
            label="Admin only"
            color="error"
            size="small"
            sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em' }}
          />
        </Box>
        <Typography color="text.secondary" sx={{ fontSize: '0.875rem', ml: 0.5 }}>
          Manage platform users, assign roles, and control access.
        </Typography>
      </Box>

      {/* ── Error alert ─────────────────────────────────────────── */}
      {error && (
        <Alert
          severity="error"
          onClose={() => dispatch(clearAdminError())}
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}

      {/* ── Filters ─────────────────────────────────────────────── */}
      <Card variant="outlined" sx={{ mb: 2, p: 2, borderRadius: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ sm: 'center' }}
          flexWrap="wrap"
          useFlexGap
        >
          {/* Search */}
          <TextField
            size="small"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded fontSize="small" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 240 }}
          />

          {/* Role filter */}
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={roleFilter}
              label="Role"
              onChange={(e) => { setRoleFilter(e.target.value as UserRole | ''); setPage(0); }}
            >
              <MenuItem value="">All roles</MenuItem>
              {ALL_ROLES.map((r) => (
                <MenuItem key={r} value={r}>{ROLE_LABEL[r]}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Status filter */}
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => { setStatusFilter(e.target.value as '' | 'true' | 'false'); setPage(0); }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Active</MenuItem>
              <MenuItem value="false">Inactive</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ flex: 1 }} />

          {/* Stats */}
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            {meta?.total ?? 0} total users
          </Typography>

          {/* Refresh */}
          <Tooltip title="Refresh" arrow>
            <span>
              <IconButton size="small" onClick={load} disabled={isLoading}>
                {isLoading
                  ? <CircularProgress size={18} thickness={5} />
                  : <RefreshRounded fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Card>

      {/* ── User table ──────────────────────────────────────────── */}
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.disabled' } }}>
                <TableCell>User</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Login</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell align="right" sx={{ pr: 2 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
                    No users found
                  </TableCell>
                </TableRow>
              )}
              {users.map((user) => {
                const loading   = Boolean(rowLoading[user.id]);
                const isSelf    = user.id === currentUserId;
                const isLocked  = Boolean(user.lockedUntil && new Date(user.lockedUntil) > new Date());

                return (
                  <TableRow
                    key={user.id}
                    hover
                    sx={{
                      opacity: loading ? 0.55 : 1,
                      transition: 'opacity 0.2s ease',
                      '&:last-child td': { border: 0 },
                    }}
                  >
                    {/* ── User cell ─────────────────────────────── */}
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar
                          sx={{
                            width: 34, height: 34, fontSize: '0.7rem', fontWeight: 800,
                            flexShrink: 0,
                            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.9)}, ${theme.palette.primary.dark ?? theme.palette.primary.main})`,
                          }}
                        >
                          {initials(user)}
                        </Avatar>
                        <Box>
                          <Stack direction="row" alignItems="center" spacing={0.75}>
                            <Typography variant="body2" fontWeight={600} lineHeight={1.25}>
                              {user.firstName} {user.lastName}
                            </Typography>
                            {isSelf && (
                              <Chip label="You" size="small" color="primary" variant="outlined"
                                sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700 }} />
                            )}
                            {isLocked && (
                              <Tooltip title="Account locked" arrow>
                                <LockRounded sx={{ fontSize: 13, color: 'error.main' }} />
                              </Tooltip>
                            )}
                          </Stack>
                          <Typography variant="caption" color="text.secondary" lineHeight={1.3}>
                            {user.email}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>

                    {/* ── Role cell — inline dropdown ────────────── */}
                    <TableCell sx={{ minWidth: 190 }}>
                      <Select
                        size="small"
                        value={user.role}
                        disabled={loading || isSelf}
                        onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                        renderValue={(v) => (
                          <Chip
                            label={ROLE_LABEL[v as UserRole] ?? v}
                            color={ROLE_CHIP_COLOR[v as UserRole] ?? 'default'}
                            size="small"
                            sx={{ fontWeight: 700, fontSize: '0.7rem', pointerEvents: 'none' }}
                          />
                        )}
                        sx={{
                          '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                          '& .MuiSelect-select': { py: 0.5, pl: 0 },
                        }}
                      >
                        {ALL_ROLES.map((r) => (
                          <MenuItem key={r} value={r}>
                            <Chip
                              label={ROLE_LABEL[r]}
                              color={ROLE_CHIP_COLOR[r]}
                              size="small"
                              sx={{ fontWeight: 700, fontSize: '0.7rem', pointerEvents: 'none', mr: 1 }}
                            />
                            {ROLE_LABEL[r]}
                          </MenuItem>
                        ))}
                      </Select>
                    </TableCell>

                    {/* ── Status cell ───────────────────────────── */}
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Switch
                          size="small"
                          checked={user.isActive}
                          disabled={loading || isSelf}
                          onChange={() => handleStatusToggle(user)}
                          color="success"
                        />
                        <Chip
                          icon={user.isActive ? <PersonRounded sx={{ fontSize: '13px !important' }} /> : <PersonOffRounded sx={{ fontSize: '13px !important' }} />}
                          label={user.isActive ? 'Active' : 'Inactive'}
                          color={user.isActive ? 'success' : 'default'}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', fontWeight: 600 }}
                        />
                      </Stack>
                    </TableCell>

                    {/* ── Last login ────────────────────────────── */}
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleDateString(undefined, {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })
                          : '—'}
                      </Typography>
                    </TableCell>

                    {/* ── Joined ───────────────────────────────── */}
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(user.createdAt).toLocaleDateString(undefined, {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </Typography>
                    </TableCell>

                    {/* ── Actions ──────────────────────────────── */}
                    <TableCell align="right" sx={{ pr: 1.5 }}>
                      {loading ? (
                        <CircularProgress size={18} thickness={5} sx={{ color: 'text.disabled' }} />
                      ) : (
                        <Tooltip
                          title={isSelf ? 'You cannot delete yourself' : `Delete ${user.firstName}`}
                          arrow
                        >
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              disabled={isSelf}
                              onClick={() => setDeleteTarget(user)}
                              sx={{ opacity: isSelf ? 0.3 : 1 }}
                            >
                              <DeleteRounded fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        <Divider />

        {/* ── Pagination ──────────────────────────────────────── */}
        <TablePagination
          component="div"
          count={meta?.total ?? 0}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50]}
          sx={{ '& .MuiTablePagination-toolbar': { minHeight: 44, px: 2 } }}
        />
      </Card>

      {/* ── Delete confirm dialog ────────────────────────────── */}
      <DeleteDialog
        user={deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </Box>
  );
};
