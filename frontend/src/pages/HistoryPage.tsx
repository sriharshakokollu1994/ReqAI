import React, { useEffect, useState } from 'react';
import {
  Box, Card, Typography, Table, TableBody,
  TableCell, TableHead, TableRow, TablePagination, TextField,
  MenuItem, Skeleton, IconButton, Tooltip, Divider,
  useTheme, InputAdornment,
} from '@mui/material';
import {
  SearchRounded,
  FilterListRounded,
  VisibilityRounded,
  HistoryRounded as HistoryIcon,
  DownloadRounded,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { fetchHistoryThunk } from '../features/analysis/analysisSlice';
import { AnalysisStatusChip, ComplexityChip } from '../components/shared/StatusChips';
import { PageHeader } from '../components/shared/PageHeader';
import { format } from 'date-fns';
import type { AnalysisStatus } from '../types';

const STATUS_OPTIONS: Array<{ value: AnalysisStatus | 'ALL'; label: string }> = [
  { value: 'ALL',        label: 'All statuses' },
  { value: 'COMPLETED',  label: 'Completed'    },
  { value: 'PROCESSING', label: 'Processing'   },
  { value: 'QUEUED',     label: 'Queued'       },
  { value: 'FAILED',     label: 'Failed'       },
  { value: 'CANCELLED',  label: 'Cancelled'    },
];

export const HistoryPage: React.FC = () => {
  const theme   = useTheme();
  const navigate  = useNavigate();
  const dispatch  = useAppDispatch();
  const { history, historyTotal, isLoading } = useAppSelector((s) => s.analysis);

  const [page,        setPage]        = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [status,      setStatus]      = useState<AnalysisStatus | 'ALL'>('ALL');
  const [search,      setSearch]      = useState('');

  useEffect(() => {
    dispatch(fetchHistoryThunk({
      page:   page + 1,
      limit:  rowsPerPage,
      ...(status !== 'ALL' && { status }),
    } as any));
  }, [dispatch, page, rowsPerPage, status]);

  const filtered = search
    ? history.filter((h) =>
        h.requirementTitle.toLowerCase().includes(search.toLowerCase()) ||
        h.projectName.toLowerCase().includes(search.toLowerCase()),
      )
    : history;

  const COLS = ['Requirement', 'Project', 'Status', 'Complexity', 'Stories', 'Risks', 'Tokens', 'Cost', 'Completed', ''];

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400 }}>
      <PageHeader
        title="Analysis History"
        subtitle="All AI analyses across your projects"
        icon={<HistoryIcon />}
        action={
          <Tooltip title="Export as CSV">
            <IconButton size="small"><DownloadRounded /></IconButton>
          </Tooltip>
        }
      />

      <Card>
        {/* Toolbar */}
        <Box sx={{
          px: 2.5, py: 1.75,
          display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap',
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}>
          <TextField
            placeholder="Search requirements…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
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
            value={status}
            onChange={(e) => { setStatus(e.target.value as any); setPage(0); }}
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
            <Box component="span" fontWeight={700}>{historyTotal}</Box> total
          </Typography>
        </Box>

        {/* Table */}
        <Box sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                {COLS.map((h) => <TableCell key={h}>{h}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {COLS.map((_, j) => (
                        <TableCell key={j}><Skeleton height={18} /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={COLS.length} sx={{ textAlign: 'center', py: 6 }}>
                        <Typography color="text.secondary">
                          {search ? 'No results match your search' : 'No history yet'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )
                : filtered.map((row) => (
                    <TableRow key={row.analysisId} hover sx={{ cursor: 'pointer' }}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 200 }}>
                          {row.requirementTitle}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">{row.projectName}</Typography>
                      </TableCell>
                      <TableCell><AnalysisStatusChip status={row.status} /></TableCell>
                      <TableCell><ComplexityChip level={row.complexityLevel} /></TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{row.storyCount ?? '—'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.riskCount ?? '—'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                          {row.tokensTotal?.toLocaleString() ?? '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                          {row.costUsd ? `$${Number(row.costUsd).toFixed(4)}` : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {row.completedAt ? format(new Date(row.completedAt), 'MMM d, HH:mm') : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell padding="checkbox">
                        <Tooltip title="View analysis">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/analyzer?reqId=${row.requirementId}`)}
                          >
                            <VisibilityRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
              }
            </TableBody>
          </Table>
        </Box>

        <Divider />
        <TablePagination
          component="div"
          count={historyTotal}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50]}
          sx={{ '& .MuiTablePagination-toolbar': { minHeight: 52 } }}
        />
      </Card>
    </Box>
  );
};
