import React, { useEffect, useMemo } from 'react';
import {
  Box, Grid, Typography, Button, Card, CardContent, CardActionArea,
  Table, TableBody, TableCell, TableHead, TableRow,
  Skeleton, Divider, Stack, alpha, useTheme, Chip, Avatar,
  LinearProgress, Tooltip, IconButton,
} from '@mui/material';
import {
  AutoAwesomeRounded as AIIcon,
  HistoryRounded as HistoryIcon,
  BookmarkRounded as SavedIcon,
  DownloadRounded as ExportIcon,
  CheckCircleRounded,
  HourglassEmptyRounded,
  AssignmentRounded,
  AttachMoneyRounded,
  ArrowForwardRounded,
  TrendingUpRounded,
  WarningAmberRounded,
  QueryStatsRounded,
  TokenRounded,
  PsychologyRounded,
  FiberManualRecordRounded,
  OpenInNewRounded,
  RefreshRounded,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  fetchHistoryThunk,
  fetchSavedThunk,
} from '../features/analysis/analysisSlice';
import { fetchRequirementsThunk } from '../features/requirements/requirementSlice';
import { AnalysisStatusChip, ComplexityChip } from '../components/shared/StatusChips';
import { StatCard } from '../components/shared/StatCard';
import { format, formatDistanceToNow } from 'date-fns';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function greeting(firstName?: string): string {
  const h = new Date().getHours();
  const salutation = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return firstName ? `${salutation}, ${firstName}` : salutation;
}

/** Thin horizontal progress-like bar used in the statistics card */
const DonutBar: React.FC<{
  label: string;
  value: number;
  total: number;
  color: string;
}> = ({ label, value, total, color }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Typography variant="caption" fontWeight={700}>{value}</Typography>
          <Typography variant="caption" color="text.disabled">({pct}%)</Typography>
        </Box>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 6,
          borderRadius: 3,
          bgcolor: (t) => alpha(color, t.palette.mode === 'dark' ? 0.15 : 0.1),
          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
        }}
      />
    </Box>
  );
};

/** Mini vertical bar used for the weekly-activity sparkline */
const SparkBar: React.FC<{ value: number; max: number; color: string; day: string; isToday?: boolean }> = ({
  value, max, color, day, isToday,
}) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
    <Typography variant="caption" color={isToday ? 'primary.main' : 'text.disabled'} sx={{ fontSize: '0.65rem', fontWeight: isToday ? 700 : 400 }}>
      {value > 0 ? value : ''}
    </Typography>
    <Box sx={{ width: 28, height: 64, borderRadius: 1.5, overflow: 'hidden', bgcolor: 'action.hover', position: 'relative' }}>
      <Box sx={{
        position: 'absolute', bottom: 0, width: '100%',
        height: `${(value / Math.max(max, 1)) * 100}%`,
        bgcolor: isToday ? color : alpha(color, 0.55),
        borderRadius: 1.5,
        transition: 'height 0.7s ease',
      }} />
    </Box>
    <Typography variant="caption" color={isToday ? 'primary.main' : 'text.disabled'} sx={{ fontSize: '0.65rem', fontWeight: isToday ? 700 : 400 }}>
      {day}
    </Typography>
  </Box>
);


// ─────────────────────────────────────────────────────────────────────────────
// Action card — used for the 3 top-of-page CTA tiles
// ─────────────────────────────────────────────────────────────────────────────
interface ActionCardProps {
  icon:        React.ReactNode;
  title:       string;
  subtitle:    string;
  accent:      string;
  onClick:     () => void;
  badge?:      string;
}
const ActionCard: React.FC<ActionCardProps> = ({ icon, title, subtitle, accent, onClick, badge }) => {
  const theme  = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Card
      sx={{
        height: '100%',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
        transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
        '&:hover': {
          transform: 'translateY(-3px)',
          boxShadow: `0 8px 28px ${alpha(accent, 0.2)}`,
          borderColor: alpha(accent, 0.5),
        },
      }}
    >
      <CardActionArea onClick={onClick} sx={{ height: '100%', p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{
            width: 48, height: 48, borderRadius: 2.5,
            background: `linear-gradient(135deg, ${alpha(accent, 0.2)}, ${alpha(accent, 0.1)})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: accent, fontSize: 24,
          }}>
            {icon}
          </Box>
          {badge && (
            <Chip label={badge} size="small" sx={{ bgcolor: alpha(accent, 0.12), color: accent, fontWeight: 700, fontSize: '0.7rem', border: 'none' }} />
          )}
        </Box>
        <Typography variant="h5" fontWeight={700} gutterBottom>{title}</Typography>
        <Typography variant="caption" color="text.secondary" lineHeight={1.5}>{subtitle}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5, color: accent }}>
          <Typography variant="caption" fontWeight={700}>Open</Typography>
          <ArrowForwardRounded sx={{ fontSize: 14 }} />
        </Box>
      </CardActionArea>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DashboardPage
// ─────────────────────────────────────────────────────────────────────────────
export const DashboardPage: React.FC = () => {
  const theme    = useTheme();
  const isDark   = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // ── Redux state ────────────────────────────────────────────────────────────
  const { user }                               = useAppSelector((s) => s.auth);
  const { history, historyTotal, isLoading }   = useAppSelector((s) => s.analysis);
  const { saved,   savedTotal }                = useAppSelector((s) => s.analysis);
  const { items: requirements, total: reqTotal, isLoading: reqLoading } = useAppSelector((s) => s.requirements);
  const activeProjectId                        = useAppSelector((s) => s.ui.activeProjectId);

  // ── Data fetch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchHistoryThunk({ page: 1, limit: 8 }));
    dispatch(fetchSavedThunk({ page: 1, limit: 5 }));
    dispatch(fetchRequirementsThunk({ projectId: activeProjectId, query: { page: 1, limit: 5, sortBy: 'updatedAt', sortDir: 'desc' } }));
  }, [dispatch, activeProjectId]);

  // ── Derived statistics ─────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const completed  = history.filter((h) => h.status === 'COMPLETED').length;
    const failed     = history.filter((h) => h.status === 'FAILED').length;
    const inProgress = history.filter((h) => ['QUEUED', 'PROCESSING'].includes(h.status)).length;
    const totalCost  = history.reduce((s, h) => s + (h.costUsd ? Number(h.costUsd) : 0), 0);
    const totalTok   = history.reduce((s, h) => s + (h.tokensTotal ?? 0), 0);
    const avgRisk    = history.reduce((s, h) => s + (h.riskCount ?? 0), 0);
    return { completed, failed, inProgress, totalCost, totalTok, avgRisk };
  }, [history]);

  // ── Provider breakdown ─────────────────────────────────────────────────────
  const providerBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    history.forEach((h) => { map[h.aiProvider] = (map[h.aiProvider] ?? 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [history]);

  // ── Complexity breakdown ───────────────────────────────────────────────────
  const complexityBreakdown = useMemo(() => {
    const map: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, VERY_HIGH: 0 };
    history.forEach((h) => {
      const k = h.complexityLevel ?? 'MEDIUM';
      if (k in map) map[k]++;
    });
    return map;
  }, [history]);

  // ── Weekly activity — last 7 days slots from history ──────────────────────
  const activityData = useMemo(() => {
    const days: number[] = [0, 0, 0, 0, 0, 0, 0];
    const now = Date.now();
    history.forEach((h) => {
      if (!h.completedAt) return;
      const diff = Math.floor((now - new Date(h.completedAt).getTime()) / 86_400_000);
      if (diff >= 0 && diff < 7) days[6 - diff]++;
    });
    return days;
  }, [history]);

  const dayLabels   = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const maxActivity = Math.max(...activityData, 1);

  // ── Recent activity feed (interleave analyses + requirements) ─────────────
  const feedItems = useMemo(() => {
    const items: Array<{
      key: string; icon: React.ReactNode; color: string;
      text: string; sub: string; time: string;
    }> = [];

    history.slice(0, 4).forEach((h) => {
      items.push({
        key:   `a-${h.analysisId}`,
        icon:  <AIIcon sx={{ fontSize: 15 }} />,
        color: h.status === 'COMPLETED' ? theme.palette.success.main
             : h.status === 'FAILED'    ? theme.palette.error.main
             : theme.palette.warning.main,
        text:  h.requirementTitle,
        sub:   `Analysis ${h.status.toLowerCase()} · ${h.aiProvider}`,
        time:  h.completedAt ? formatDistanceToNow(new Date(h.completedAt), { addSuffix: true }) : '—',
      });
    });

    requirements.slice(0, 3).forEach((r) => {
      items.push({
        key:   `r-${r.id}`,
        icon:  <AssignmentRounded sx={{ fontSize: 15 }} />,
        color: theme.palette.primary.main,
        text:  r.title,
        sub:   `Requirement · ${r.status}`,
        time:  formatDistanceToNow(new Date(r.updatedAt), { addSuffix: true }),
      });
    });

    return items.slice(0, 7); // order preserved from above
  }, [history, requirements, theme]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: { xs: 2, sm: 2.5, md: 3 }, maxWidth: 1440 }}>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <Box sx={{
        display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' },
        gap: 2, mb: 3,
      }}>
        <Box>
          <Typography variant="h2" sx={{ mb: 0.25 }}>
            {greeting(user?.firstName)} 👋
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Here's your AI requirement analysis overview
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexShrink: 0 }}>
          <Tooltip title="Refresh data">
            <IconButton
              size="small"
              onClick={() => {
                dispatch(fetchHistoryThunk({ page: 1, limit: 8 }));
                dispatch(fetchSavedThunk({ page: 1, limit: 5 }));
              }}
            >
              <RefreshRounded fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AIIcon />}
            onClick={() => navigate('/analyzer')}
            sx={{ display: { xs: 'none', sm: 'flex' } }}
          >
            New Analysis
          </Button>
        </Box>
      </Box>

      {/* ── Row 1: 6 stat cards ────────────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          {
            title:    'Total Analyses',
            value:    isLoading ? '—' : historyTotal,
            subtitle: 'all time',
            icon:     <AIIcon sx={{ fontSize: 20 }} />,
            accent:   '#6C63FF',
            trend:    { value: 12, label: 'vs last week' },
          },
          {
            title:    'Completed',
            value:    isLoading ? '—' : stats.completed,
            subtitle: 'this page',
            icon:     <CheckCircleRounded sx={{ fontSize: 20 }} />,
            accent:   '#14B869',
          },
          {
            title:    'In Progress',
            value:    isLoading ? '—' : stats.inProgress,
            subtitle: 'queued + processing',
            icon:     <HourglassEmptyRounded sx={{ fontSize: 20 }} />,
            accent:   '#FFB020',
          },
          {
            title:    'Requirements',
            value:    reqLoading ? '—' : reqTotal,
            subtitle: 'total saved',
            icon:     <AssignmentRounded sx={{ fontSize: 20 }} />,
            accent:   '#2196F3',
          },
          {
            title:    'Total Tokens',
            value:    isLoading ? '—' : stats.totalTok > 999 ? `${(stats.totalTok / 1000).toFixed(1)}k` : stats.totalTok,
            subtitle: 'consumed',
            icon:     <TokenRounded sx={{ fontSize: 20 }} />,
            accent:   '#00D4AA',
          },
          {
            title:    'AI Cost',
            value:    isLoading ? '—' : `$${stats.totalCost.toFixed(4)}`,
            subtitle: 'estimated spend',
            icon:     <AttachMoneyRounded sx={{ fontSize: 20 }} />,
            accent:   '#FF7043',
            trend:    stats.totalCost > 0 ? { value: -8, label: 'vs last week' } : undefined,
          },
        ].map((s) => (
          <Grid item xs={12} sm={6} md={4} lg={2} key={s.title}>
            <StatCard {...s} loading={isLoading || reqLoading} />
          </Grid>
        ))}
      </Grid>

      {/* ── Row 2: 3 CTA action cards ──────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <ActionCard
            icon={<PsychologyRounded fontSize="inherit" />}
            title="Analyze Requirement"
            subtitle="Transform raw requirements into 14 AI-generated development artifacts"
            accent="#6C63FF"
            onClick={() => navigate('/analyzer')}
            badge="14 artifacts"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <ActionCard
            icon={<SavedIcon fontSize="inherit" />}
            title="Saved Requirements"
            subtitle="Access your bookmarked analyses and requirements in your personal library"
            accent="#00D4AA"
            onClick={() => navigate('/saved')}
            badge={savedTotal > 0 ? String(savedTotal) : undefined}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <ActionCard
            icon={<ExportIcon fontSize="inherit" />}
            title="Export Reports"
            subtitle="Download analyses as PDF, Markdown, or JSON for sharing and documentation"
            accent="#FFB020"
            onClick={() => navigate('/history')}
            badge="PDF / MD / JSON"
          />
        </Grid>
      </Grid>

      {/* ── Row 3: Recent analyses table + statistics ────────────────────── */}
      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>

        {/* Recent analyses — full-width on mobile, 8/12 on lg */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ height: '100%' }}>
            {/* Card header */}
            <Box sx={{
              px: 2.5, pt: 2.5, pb: 1.5,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <Box>
                <Typography variant="h5" fontWeight={700}>Recent Analyses</Typography>
                <Typography variant="caption" color="text.secondary">
                  Latest AI analysis runs across your project
                </Typography>
              </Box>
              <Button
                size="small"
                endIcon={<ArrowForwardRounded fontSize="small" />}
                onClick={() => navigate('/history')}
              >
                View all
              </Button>
            </Box>
            <Divider />

            {isLoading ? (
              <Box sx={{ p: 2.5 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                    <Skeleton variant="rounded" width="30%" height={18} />
                    <Skeleton variant="rounded" width="12%" height={20} sx={{ borderRadius: 10 }} />
                    <Skeleton variant="rounded" width="12%" height={20} sx={{ borderRadius: 10 }} />
                    <Skeleton variant="rounded" width="8%"  height={18} />
                    <Skeleton variant="rounded" width="10%" height={18} />
                    <Skeleton variant="rounded" width="12%" height={18} />
                  </Box>
                ))}
              </Box>
            ) : history.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <Box sx={{
                  width: 64, height: 64, borderRadius: '18px', mx: 'auto', mb: 2,
                  background: alpha('#6C63FF', 0.1),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <AIIcon sx={{ fontSize: 32, color: 'primary.main', opacity: 0.7 }} />
                </Box>
                <Typography variant="h5" color="text.secondary" gutterBottom>No analyses yet</Typography>
                <Typography variant="body2" color="text.secondary" mb={2.5}>
                  Run your first AI analysis to see results here
                </Typography>
                <Button variant="contained" startIcon={<AIIcon />} onClick={() => navigate('/analyzer')}>
                  Analyze a requirement
                </Button>
              </Box>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 560 }}>
                  <TableHead>
                    <TableRow>
                      {['Requirement', 'Status', 'Complexity', 'Risks', 'Cost', 'Date'].map((h) => (
                        <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                          {h}
                        </TableCell>
                      ))}
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {history.map((row) => (
                      <TableRow
                        key={row.analysisId}
                        hover
                        sx={{
                          cursor: 'pointer',
                          '&:last-child td': { borderBottom: 0 },
                        }}
                        onClick={() => navigate(`/analyzer?requirementId=${row.requirementId}`)}
                      >
                        <TableCell sx={{ maxWidth: 220 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>{row.requirementTitle}</Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>{row.projectName}</Typography>
                        </TableCell>
                        <TableCell><AnalysisStatusChip status={row.status} /></TableCell>
                        <TableCell>
                          {row.complexityLevel
                            ? <ComplexityChip level={row.complexityLevel} />
                            : <Typography variant="caption" color="text.disabled">—</Typography>
                          }
                        </TableCell>
                        <TableCell>
                          {row.riskCount != null ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {row.riskCount >= 5 && <WarningAmberRounded sx={{ fontSize: 14, color: 'error.main' }} />}
                              <Typography variant="body2" fontWeight={600}>{row.riskCount}</Typography>
                            </Box>
                          ) : (
                            <Typography variant="caption" color="text.disabled">—</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                            {row.costUsd ? `$${Number(row.costUsd).toFixed(4)}` : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {row.completedAt ? format(new Date(row.completedAt), 'MMM d, HH:mm') : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell padding="none" sx={{ pr: 1 }}>
                          <Tooltip title="Open in Analyzer">
                            <IconButton size="small" sx={{ opacity: 0.4, '&:hover': { opacity: 1 } }}>
                              <OpenInNewRounded sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Card>
        </Grid>

        {/* Statistics card */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: '100%' }}>
            <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <QueryStatsRounded sx={{ color: 'primary.main', fontSize: 20 }} />
              <Box>
                <Typography variant="h5" fontWeight={700}>Statistics</Typography>
                <Typography variant="caption" color="text.secondary">Analysis breakdown</Typography>
              </Box>
            </Box>
            <Divider />
            <CardContent sx={{ p: 2.5 }}>

              {/* Status distribution */}
              <Typography variant="overline" color="text.secondary" display="block" mb={1.25}>
                By Status
              </Typography>
              <Stack spacing={1.25} mb={2.5}>
                <DonutBar
                  label="Completed"
                  value={stats.completed}
                  total={history.length}
                  color={theme.palette.success.main}
                />
                <DonutBar
                  label="In Progress"
                  value={stats.inProgress}
                  total={history.length}
                  color={theme.palette.warning.main}
                />
                <DonutBar
                  label="Failed"
                  value={stats.failed}
                  total={history.length}
                  color={theme.palette.error.main}
                />
              </Stack>

              {/* Complexity breakdown */}
              <Typography variant="overline" color="text.secondary" display="block" mb={1.25}>
                By Complexity
              </Typography>
              <Stack spacing={1} mb={2.5}>
                {(
                  [
                    { key: 'LOW',       color: theme.palette.success.main  },
                    { key: 'MEDIUM',    color: theme.palette.warning.main  },
                    { key: 'HIGH',      color: theme.palette.error.main    },
                    { key: 'VERY_HIGH', color: '#b91c1c'                   },
                  ] as const
                ).map(({ key, color }) => (
                  <DonutBar
                    key={key}
                    label={key.replace('_', ' ')}
                    value={complexityBreakdown[key] ?? 0}
                    total={history.length}
                    color={color}
                  />
                ))}
              </Stack>

              {/* AI Provider breakdown */}
              {providerBreakdown.length > 0 && (
                <>
                  <Typography variant="overline" color="text.secondary" display="block" mb={1}>
                    By AI Provider
                  </Typography>
                  <Stack spacing={1}>
                    {providerBreakdown.map(([provider, count]) => (
                      <Box key={provider} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FiberManualRecordRounded sx={{ fontSize: 8, color: 'primary.main' }} />
                          <Typography variant="caption">{provider}</Typography>
                        </Box>
                        <Chip
                          label={count}
                          size="small"
                          sx={{ height: 18, fontSize: '0.7rem', fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', border: 'none' }}
                        />
                      </Box>
                    ))}
                  </Stack>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Row 4: Saved requirements + Weekly activity + Recent activity ─── */}
      <Grid container spacing={2.5}>

        {/* Saved requirements */}
        <Grid item xs={12} md={5} lg={4}>
          <Card sx={{ height: '100%' }}>
            <Box sx={{
              px: 2.5, pt: 2.5, pb: 1.5,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SavedIcon sx={{ color: '#00D4AA', fontSize: 20 }} />
                <Box>
                  <Typography variant="h5" fontWeight={700}>Saved Requirements</Typography>
                  <Typography variant="caption" color="text.secondary">Your bookmarked analyses</Typography>
                </Box>
              </Box>
              <Button size="small" endIcon={<ArrowForwardRounded fontSize="small" />} onClick={() => navigate('/saved')}>
                See all
              </Button>
            </Box>
            <Divider />
            <CardContent sx={{ p: 0 }}>
              {isLoading ? (
                <Box sx={{ p: 2.5 }}>
                  {[1, 2, 3].map((i) => (
                    <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'center' }}>
                      <Skeleton variant="circular" width={36} height={36} />
                      <Box sx={{ flex: 1 }}>
                        <Skeleton width="70%" height={16} />
                        <Skeleton width="40%" height={14} sx={{ mt: 0.5 }} />
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : saved.length === 0 ? (
                <Box sx={{ py: 5, textAlign: 'center', px: 2 }}>
                  <SavedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    No saved analyses yet.{' '}
                    <Box
                      component="span"
                      sx={{ color: 'primary.main', cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => navigate('/analyzer')}
                    >
                      Run one now.
                    </Box>
                  </Typography>
                </Box>
              ) : (
                <Stack divider={<Divider />}>
                  {saved.map((item) => (
                    <Box
                      key={item.analysisId}
                      onClick={() => navigate(`/analyzer?requirementId=${item.requirementId}`)}
                      sx={{
                        display: 'flex', gap: 1.5, alignItems: 'center',
                        px: 2.5, py: 1.5, cursor: 'pointer',
                        transition: 'background .15s ease',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Avatar sx={{
                        width: 36, height: 36, flexShrink: 0,
                        bgcolor: alpha('#00D4AA', 0.12),
                        color: '#00D4AA', fontSize: '0.8rem', fontWeight: 700,
                      }}>
                        {item.requirementTitle.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {item.requirementTitle}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', mt: 0.25 }}>
                          <ComplexityChip level={item.complexityLevel} />
                          {item.completedAt && (
                            <Typography variant="caption" color="text.disabled">
                              {format(new Date(item.completedAt), 'MMM d')}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      <ArrowForwardRounded sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Weekly activity sparkline */}
        <Grid item xs={12} sm={6} md={3} lg={2}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <TrendingUpRounded sx={{ color: 'primary.main', fontSize: 20 }} />
                <Typography variant="h5" fontWeight={700}>Activity</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" mb={2}>
                Last 7 days
              </Typography>

              <Box sx={{
                flex: 1, display: 'flex', alignItems: 'flex-end',
                justifyContent: 'space-between', gap: 0.5, mb: 1.5,
              }}>
                {activityData.map((v, i) => (
                  <SparkBar
                    key={i}
                    value={v}
                    max={maxActivity}
                    color={theme.palette.primary.main}
                    day={dayLabels[i]}
                    isToday={i === 6}
                  />
                ))}
              </Box>

              <Divider sx={{ my: 1.5 }} />

              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">Total this week</Typography>
                  <Typography variant="caption" fontWeight={700}>
                    {activityData.reduce((a, b) => a + b, 0)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">Daily avg</Typography>
                  <Typography variant="caption" fontWeight={700}>
                    {(activityData.reduce((a, b) => a + b, 0) / 7).toFixed(1)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent activity feed */}
        <Grid item xs={12} sm={6} md={4} lg={6}>
          <Card sx={{ height: '100%' }}>
            <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Box>
                <Typography variant="h5" fontWeight={700}>Recent Activity</Typography>
                <Typography variant="caption" color="text.secondary">Latest changes across your workspace</Typography>
              </Box>
            </Box>
            <Divider />
            <CardContent sx={{ p: 0 }}>
              {isLoading ? (
                <Box sx={{ p: 2.5 }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                      <Skeleton variant="circular" width={28} height={28} />
                      <Box sx={{ flex: 1 }}>
                        <Skeleton width="65%" height={15} />
                        <Skeleton width="45%" height={13} sx={{ mt: 0.5 }} />
                      </Box>
                      <Skeleton width="18%" height={13} />
                    </Box>
                  ))}
                </Box>
              ) : feedItems.length === 0 ? (
                <Box sx={{ py: 5, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">No recent activity</Typography>
                </Box>
              ) : (
                <Stack divider={<Divider />}>
                  {feedItems.map((item) => (
                    <Box
                      key={item.key}
                      sx={{
                        display: 'flex', gap: 1.5, alignItems: 'flex-start',
                        px: 2.5, py: 1.5,
                        transition: 'background .15s ease',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      {/* Icon avatar */}
                      <Avatar sx={{
                        width: 30, height: 30, flexShrink: 0,
                        bgcolor: alpha(item.color, 0.12),
                        color: item.color, fontSize: '0.75rem',
                      }}>
                        {item.icon}
                      </Avatar>

                      {/* Text */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>{item.text}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>{item.sub}</Typography>
                      </Box>

                      {/* Time */}
                      <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0, fontSize: '0.68rem' }}>
                        {item.time}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

      </Grid>

      {/* ── AI provider status banner ─────────────────────────────────────── */}
      <Box sx={{
        mt: 2.5,
        p: 1.75,
        borderRadius: 2.5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1,
        background: isDark
          ? `linear-gradient(135deg, ${alpha('#6C63FF', 0.12)}, ${alpha('#00D4AA', 0.06)})`
          : `linear-gradient(135deg, ${alpha('#6C63FF', 0.06)}, ${alpha('#00D4AA', 0.03)})`,
        border: `1px solid ${alpha('#6C63FF', isDark ? 0.2 : 0.12)}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AIIcon sx={{ color: 'primary.main', fontSize: 18 }} />
          <Typography variant="body2" fontWeight={600}>AI Provider</Typography>
          <Chip
            label="Online"
            color="success"
            size="small"
            icon={<FiberManualRecordRounded sx={{ fontSize: '8px !important' }} />}
            sx={{ height: 20, fontSize: '0.7rem' }}
          />
          <Typography variant="caption" color="text.secondary">OpenAI GPT-4o · PromptBuilder v2 · 14 artifact types</Typography>
        </Box>
        <Button
          size="small" variant="outlined"
          endIcon={<ArrowForwardRounded fontSize="small" />}
          onClick={() => navigate('/settings')}
          sx={{ fontSize: '0.75rem' }}
        >
          Configure
        </Button>
      </Box>

    </Box>
  );
};
