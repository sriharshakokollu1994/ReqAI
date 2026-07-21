import React, { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Grid, Card, CardContent, CardActions, Typography, Button,
  Chip, Divider, IconButton, LinearProgress, Stack,
  Alert, Breadcrumbs, Link, Paper, CircularProgress, alpha, useTheme,
} from '@mui/material';
import {
  PictureAsPdfRounded,
  ArticleRounded,
  CodeRounded,
  DataObjectRounded,
  DownloadRounded,
  ContentCopyRounded,
  OpenInNewRounded,
  CheckCircleRounded,
  ErrorRounded,
  NavigateNextRounded,
  HistoryRounded,
  FileDownloadRounded,
  ArrowBackRounded,
  AutoAwesomeRounded,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  exportPdfThunk,
  exportDocxThunk,
  exportMarkdownThunk,
  exportJsonThunk,
  setAnalysisId,
  clearJobs,
} from '../features/export/exportSlice';
import { fetchAnalysisThunk } from '../features/analysis/analysisSlice';
import { showNotification } from '../features/notifications/notificationSlice';
import { ExportFormat } from '../types';

// ─── Format metadata ──────────────────────────────────────────────────────────

interface FormatMeta {
  format:      ExportFormat;
  label:       string;
  description: string;
  icon:        React.ReactNode;
  accentColor: string;
  extension:   string;
  sizeSuffix:  string;
  useCases:    string[];
}

const FORMAT_META: FormatMeta[] = [
  {
    format:      'pdf',
    label:       'PDF Document',
    description: 'A formatted, print-ready PDF with all analysis artifacts, headings, and structured sections — ideal for sharing with stakeholders.',
    icon:        <PictureAsPdfRounded sx={{ fontSize: 32 }} />,
    accentColor: '#E53935',
    extension:   '.pdf',
    sizeSuffix:  '~120 KB',
    useCases:    ['Stakeholder reviews', 'Archiving', 'Printed reports'],
  },
  {
    format:      'docx',
    label:       'Word Document (DOCX)',
    description: 'An editable Microsoft Word document with styled headings, tables, and formatted lists — ready for collaborative editing.',
    icon:        <ArticleRounded sx={{ fontSize: 32 }} />,
    accentColor: '#1565C0',
    extension:   '.docx',
    sizeSuffix:  '~85 KB',
    useCases:    ['Team collaboration', 'Documentation', 'Client deliverables'],
  },
  {
    format:      'markdown',
    label:       'Markdown File',
    description: 'A plain-text Markdown file with GitHub-flavored syntax — perfect for developer wikis, READMEs, and version-controlled documentation.',
    icon:        <CodeRounded sx={{ fontSize: 32 }} />,
    accentColor: '#6A1B9A',
    extension:   '.md',
    sizeSuffix:  '~18 KB',
    useCases:    ['GitHub wikis', 'Confluence', 'Developer docs'],
  },
  {
    format:      'json',
    label:       'JSON Export',
    description: 'A structured JSON payload with all 14 artifact types and their full content — consumable by downstream pipelines, APIs, and tools.',
    icon:        <DataObjectRounded sx={{ fontSize: 32 }} />,
    accentColor: '#2E7D32',
    extension:   '.json',
    sizeSuffix:  '~45 KB',
    useCases:    ['API integrations', 'CI/CD pipelines', 'Custom tooling'],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const ExportPage: React.FC = () => {
  const { analysisId } = useParams<{ analysisId: string }>();
  const theme          = useTheme();
  const navigate       = useNavigate();
  const dispatch       = useAppDispatch();

  const jobs      = useAppSelector((s) => s.export.jobs);
  const analysis  = useAppSelector((s) => s.analysis.current);
  const isLoading = useAppSelector((s) => s.analysis.isLoading);
  const { activeProjectId } = useAppSelector((s) => s.ui);

  const [downloadAllInProgress, setDownloadAllInProgress] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (analysisId) {
      dispatch(setAnalysisId(analysisId));
      dispatch(clearJobs());
    }
    return () => { dispatch(clearJobs()); };
  }, [analysisId, dispatch]);

  useEffect(() => {
    if (analysisId && !analysis) {
      dispatch(fetchAnalysisThunk({
        projectId:     activeProjectId,
        requirementId: analysisId, // treated as requirementId for the lookup — see note
      }));
    }
  }, [analysisId, analysis, activeProjectId, dispatch]);

  // ── Thunk map ──────────────────────────────────────────────────────────────

  const thunkMap: Record<ExportFormat, typeof exportPdfThunk> = {
    pdf:      exportPdfThunk,
    docx:     exportDocxThunk,
    markdown: exportMarkdownThunk,
    json:     exportJsonThunk,
  };

  // ── Single format download ─────────────────────────────────────────────────

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!analysisId) return;
      const result = await dispatch(thunkMap[format](analysisId));
      if (thunkMap[format].fulfilled.match(result)) {
        dispatch(showNotification({ message: `${format.toUpperCase()} exported successfully`, severity: 'success' }));
      } else {
        dispatch(showNotification({ message: (result.payload as string) ?? 'Export failed', severity: 'error' }));
      }
    },
    [analysisId, dispatch],
  );

  // ── Download all ───────────────────────────────────────────────────────────

  const handleDownloadAll = useCallback(async () => {
    if (!analysisId) return;
    setDownloadAllInProgress(true);
    const formats: ExportFormat[] = ['pdf', 'docx', 'markdown', 'json'];
    for (const fmt of formats) {
      // Sequential with small delay to avoid browser download conflicts
      await dispatch(thunkMap[fmt](analysisId));
      await new Promise((r) => setTimeout(r, 800));
    }
    setDownloadAllInProgress(false);
    dispatch(showNotification({ message: 'All 4 formats downloaded', severity: 'success' }));
  }, [analysisId, dispatch]);

  // ── Copy JSON to clipboard ─────────────────────────────────────────────────

  const handleCopyJson = useCallback(async () => {
    if (!analysis) return;
    const payload = {
      analysisId: analysis.id,
      status:     analysis.status,
      artifacts:  analysis.artifacts.map((a) => ({ type: a.artifactType, content: a.content })),
      exportedAt: new Date().toISOString(),
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setJsonCopied(true);
    dispatch(showNotification({ message: 'JSON copied to clipboard', severity: 'success' }));
    setTimeout(() => setJsonCopied(false), 3000);
  }, [analysis, dispatch]);

  // ── Derived metadata ───────────────────────────────────────────────────────

  const artifactCount = analysis?.artifacts.length ?? 0;
  const completedAt   = analysis?.completedAt
    ? new Date(analysis.completedAt).toLocaleString()
    : null;
  const tokensTotal   = analysis?.tokensTotal?.toLocaleString() ?? '—';
  const costUsd       = analysis?.costUsd != null
    ? `$${analysis.costUsd.toFixed(4)}`
    : '—';
  const anyLoading    = Object.values(jobs).some((j) => j.isLoading) || downloadAllInProgress;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>

      {/* ── Breadcrumb ──────────────────────────────────────────────────────── */}
      <Breadcrumbs
        separator={<NavigateNextRounded sx={{ fontSize: 16 }} />}
        sx={{ mb: 2.5 }}
      >
        <Link
          component="button"
          underline="hover"
          color="text.secondary"
          sx={{ fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', border: 0, background: 'none' }}
          onClick={() => navigate('/history')}
        >
          <HistoryRounded sx={{ fontSize: 15 }} /> History
        </Link>
        <Link
          component="button"
          underline="hover"
          color="text.secondary"
          sx={{ fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', border: 0, background: 'none' }}
          onClick={() => navigate('/analyzer')}
        >
          <AutoAwesomeRounded sx={{ fontSize: 15 }} /> Analyzer
        </Link>
        <Typography color="text.primary" sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
          Export
        </Typography>
      </Breadcrumbs>

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <IconButton
              size="small"
              onClick={() => navigate(-1)}
              sx={{ mr: 0.5 }}
            >
              <ArrowBackRounded fontSize="small" />
            </IconButton>
            <Typography variant="h5" fontWeight={800} letterSpacing="-0.01em">
              Export Analysis
            </Typography>
          </Box>
          <Typography color="text.secondary" sx={{ fontSize: '0.875rem', ml: 5 }}>
            Download your analysis artifacts in your preferred format.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            size="small"
            startIcon={jsonCopied ? <CheckCircleRounded /> : <ContentCopyRounded />}
            onClick={handleCopyJson}
            disabled={!analysis || jsonCopied}
            color={jsonCopied ? 'success' : 'primary'}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {jsonCopied ? 'Copied!' : 'Copy JSON'}
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={
              downloadAllInProgress
                ? <CircularProgress size={16} thickness={5} sx={{ color: 'inherit' }} />
                : <FileDownloadRounded />
            }
            onClick={handleDownloadAll}
            disabled={anyLoading || !analysisId}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {downloadAllInProgress ? 'Downloading…' : 'Download All (4)'}
          </Button>
        </Stack>
      </Box>

      {/* ── Analysis metadata summary bar ───────────────────────────────────── */}
      {isLoading ? (
        <LinearProgress sx={{ mb: 3, borderRadius: 1 }} />
      ) : analysis ? (
        <Paper
          variant="outlined"
          sx={{ p: 2, mb: 3, borderRadius: 2, display: 'flex', gap: 3, flexWrap: 'wrap' }}
        >
          {[
            { label: 'Analysis ID',    value: analysisId?.slice(0, 8) + '…' },
            { label: 'AI Provider',    value: analysis.aiProvider },
            { label: 'Model',          value: analysis.aiModel },
            { label: 'Artifacts',      value: `${artifactCount} / 14` },
            { label: 'Tokens Used',    value: tokensTotal },
            { label: 'Cost',           value: costUsd },
            { label: 'Completed At',   value: completedAt ?? '—' },
          ].map(({ label, value }) => (
            <Box key={label}>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.disabled' }}>
                {label}
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary', mt: 0.25 }}>
                {value}
              </Typography>
            </Box>
          ))}
        </Paper>
      ) : null}

      {/* ── Format cards ────────────────────────────────────────────────────── */}
      <Grid container spacing={2.5}>
        {FORMAT_META.map((meta) => {
          const job     = jobs[meta.format];
          const loading = job.isLoading;
          const done    = Boolean(job.lastExportedAt);
          const hasErr  = Boolean(job.error);

          return (
            <Grid item xs={12} sm={6} key={meta.format}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 3,
                  borderColor: done
                    ? 'success.main'
                    : hasErr
                    ? 'error.main'
                    : theme.palette.divider,
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  '&:hover': {
                    boxShadow: `0 4px 20px ${alpha(meta.accentColor, 0.12)}`,
                    borderColor: alpha(meta.accentColor, 0.6),
                  },
                }}
              >
                <CardContent sx={{ flex: 1, p: 2.5 }}>
                  {/* Card header */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                    <Box sx={{
                      width: 52, height: 52, borderRadius: 2,
                      bgcolor: alpha(meta.accentColor, 0.1),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      color: meta.accentColor,
                    }}>
                      {meta.icon}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography fontWeight={700} fontSize="0.9375rem">
                          {meta.label}
                        </Typography>
                        <Chip
                          label={meta.extension}
                          size="small"
                          sx={{
                            height: 20, fontSize: '0.65rem', fontWeight: 700,
                            bgcolor: alpha(meta.accentColor, 0.1),
                            color:   meta.accentColor,
                            letterSpacing: '0.04em',
                          }}
                        />
                        {done && (
                          <Chip
                            icon={<CheckCircleRounded sx={{ fontSize: '13px !important' }} />}
                            label="Downloaded"
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                          />
                        )}
                      </Box>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', mt: 0.25 }}>
                        Estimated size: {meta.sizeSuffix}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Description */}
                  <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', lineHeight: 1.6, mb: 2 }}>
                    {meta.description}
                  </Typography>

                  {/* Use cases */}
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    {meta.useCases.map((uc) => (
                      <Chip
                        key={uc}
                        label={uc}
                        size="small"
                        variant="outlined"
                        sx={{
                          height: 22, fontSize: '0.7rem', fontWeight: 500,
                          borderColor: alpha(meta.accentColor, 0.3),
                          color: meta.accentColor,
                        }}
                      />
                    ))}
                  </Box>

                  {/* Error alert */}
                  {hasErr && (
                    <Alert
                      severity="error"
                      icon={<ErrorRounded fontSize="small" />}
                      sx={{ mt: 2, py: 0.5, fontSize: '0.8rem' }}
                    >
                      {job.error}
                    </Alert>
                  )}

                  {/* Last exported timestamp */}
                  {done && job.lastExportedAt && (
                    <Typography sx={{ mt: 1.5, fontSize: '0.75rem', color: 'success.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CheckCircleRounded sx={{ fontSize: 14 }} />
                      Last downloaded: {new Date(job.lastExportedAt).toLocaleTimeString()}
                    </Typography>
                  )}
                </CardContent>

                <Divider />

                <CardActions sx={{ px: 2.5, py: 1.5, gap: 1 }}>
                  <Button
                    variant={done ? 'outlined' : 'contained'}
                    size="small"
                    fullWidth
                    startIcon={
                      loading
                        ? <CircularProgress size={16} thickness={5} sx={{ color: 'inherit' }} />
                        : done
                        ? <DownloadRounded />
                        : <DownloadRounded />
                    }
                    onClick={() => handleExport(meta.format)}
                    disabled={loading || !analysisId}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      bgcolor: !done ? meta.accentColor : undefined,
                      '&:hover': { bgcolor: !done ? alpha(meta.accentColor, 0.85) : undefined },
                    }}
                  >
                    {loading
                      ? 'Generating…'
                      : done
                      ? `Re-download ${meta.extension}`
                      : `Download ${meta.extension}`}
                  </Button>
                  {loading && (
                    <LinearProgress
                      sx={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        borderBottomLeftRadius: 3, borderBottomRightRadius: 3,
                        bgcolor: alpha(meta.accentColor, 0.1),
                        '& .MuiLinearProgress-bar': { bgcolor: meta.accentColor },
                      }}
                    />
                  )}
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* ── Bottom action bar ────────────────────────────────────────────────── */}
      <Box
        sx={{
          mt: 4, p: 2.5,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
          bgcolor: alpha(theme.palette.primary.main, 0.02),
        }}
      >
        <Box>
          <Typography fontWeight={700} fontSize="0.9rem">
            Need a custom export?
          </Typography>
          <Typography color="text.secondary" fontSize="0.8rem" sx={{ mt: 0.25 }}>
            Contact your administrator to configure additional export formats or templates.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="text"
            size="small"
            startIcon={<ArrowBackRounded />}
            onClick={() => navigate('/analyzer')}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Back to Analyzer
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<OpenInNewRounded />}
            onClick={() => navigate('/history')}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            View History
          </Button>
        </Stack>
      </Box>
    </Box>
  );
};
