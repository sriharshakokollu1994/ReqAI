import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Chip, Button,
  Stack, Skeleton, Divider, IconButton, Tooltip, TextField,
  InputAdornment,
} from '@mui/material';
import {
  BookmarkRemove, Visibility as ViewIcon,
  Search as SearchIcon,
  Bookmark as BookmarkIcon, BookmarkBorder,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { fetchSavedThunk } from '../features/analysis/analysisSlice';
import { AnalysisStatusChip, ComplexityChip } from '../components/shared/StatusChips';
import { showNotification } from '../features/notifications/notificationSlice';
import { apiClient } from '../services/apiClient';
import { format } from 'date-fns';

export const SavedPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { saved, savedTotal, isLoading } = useAppSelector((s) => s.analysis);

  const [search, setSearch] = useState('');
  const [page,   setPage]   = useState(1);

  useEffect(() => {
    dispatch(fetchSavedThunk({ page, limit: 12 }));
  }, [dispatch, page]);

  const handleUnsave = async (analysisId: string) => {
    try {
      await apiClient.delete(`/history/saved/${analysisId}`);
      dispatch(fetchSavedThunk({ page, limit: 12 }));
      dispatch(showNotification({ message: 'Removed from saved analyses', severity: 'info' }));
    } catch {
      dispatch(showNotification({ message: 'Failed to unsave', severity: 'error' }));
    }
  };

  const filtered = search
    ? saved.filter((s) =>
        s.requirementTitle.toLowerCase().includes(search.toLowerCase()) ||
        s.projectName.toLowerCase().includes(search.toLowerCase()),
      )
    : saved;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} mb={0.5}>Saved Analyses</Typography>
          <Typography variant="body2" color="text.secondary">
            Your personal library of saved AI analyses
          </Typography>
        </Box>
        <Chip
          label={`${savedTotal} saved`}
          color="primary"
          icon={<BookmarkIcon />}
        />
      </Box>

      {/* Search */}
      <TextField
        fullWidth
        size="small"
        placeholder="Search by requirement or project…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 3 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
        }}
      />

      {/* Cards grid */}
      {isLoading ? (
        <Grid container spacing={2.5}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Grid item xs={12} sm={6} lg={4} key={i}>
              <Skeleton height={200} variant="rounded" />
            </Grid>
          ))}
        </Grid>
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <BookmarkBorder sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            {search ? 'No results match your search' : 'No saved analyses yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            {!search && 'Save an analysis from the Analyzer page to build your library'}
          </Typography>
          {!search && (
            <Button variant="contained" onClick={() => navigate('/analyzer')}>
              Run an analysis
            </Button>
          )}
        </Box>
      ) : (
        <Grid container spacing={2.5}>
          {filtered.map((item) => (
            <Grid item xs={12} sm={6} lg={4} key={item.analysisId}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flex: 1, p: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                    <AnalysisStatusChip status={item.status} />
                    <Tooltip title="Remove from saved">
                      <IconButton size="small" onClick={() => handleUnsave(item.analysisId)} color="error">
                        <BookmarkRemove fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <Typography variant="subtitle1" fontWeight={600} gutterBottom noWrap>
                    {item.requirementTitle}
                  </Typography>

                  <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                    {item.projectName}
                  </Typography>

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={2}>
                    <ComplexityChip level={item.complexityLevel} />
                    {item.storyCount != null && (
                      <Chip label={`${item.storyCount} stories`} size="small" />
                    )}
                    {item.costUsd != null && (
                      <Chip label={`$${Number(item.costUsd).toFixed(4)}`} size="small" variant="outlined" />
                    )}
                  </Stack>

                  <Divider sx={{ mb: 1.5 }} />

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">
                      {item.completedAt ? format(new Date(item.completedAt), 'MMM d, yyyy') : '—'}
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<ViewIcon />}
                      onClick={() => navigate(`/analyzer?requirementId=${item.requirementId}`)}
                    >
                      View
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Pagination */}
      {savedTotal > 12 && (
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 1 }}>
          <Button disabled={page <= 1} onClick={() => setPage(p => p - 1)} variant="outlined" size="small">Previous</Button>
          <Typography variant="body2" sx={{ alignSelf: 'center' }}>Page {page}</Typography>
          <Button disabled={page * 12 >= savedTotal} onClick={() => setPage(p => p + 1)} variant="outlined" size="small">Next</Button>
        </Box>
      )}
    </Box>
  );
};
