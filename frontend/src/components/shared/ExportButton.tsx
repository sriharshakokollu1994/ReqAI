import React, { useState, useCallback } from 'react';
import {
  Button, Menu, MenuItem, ListItemIcon, ListItemText,
  CircularProgress, Divider, Tooltip, Typography, alpha, useTheme,
} from '@mui/material';
import {
  FileDownloadRounded,
  PictureAsPdfRounded,
  ArticleRounded,
  CodeRounded,
  DataObjectRounded,
  KeyboardArrowDownRounded,
  CheckCircleRounded,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  exportPdfThunk,
  exportDocxThunk,
  exportMarkdownThunk,
  exportJsonThunk,
} from '../../features/export/exportSlice';
import { setAnalysisId } from '../../features/export/exportSlice';
import { showNotification } from '../../features/notifications/notificationSlice';
import { ExportFormat } from '../../types';

// ─── Format config ────────────────────────────────────────────────────────────

interface FormatConfig {
  format:  ExportFormat;
  label:   string;
  icon:    React.ReactNode;
  color:   string;
}

const FORMAT_CONFIGS: FormatConfig[] = [
  {
    format: 'pdf',
    label:  'Export as PDF',
    icon:   <PictureAsPdfRounded fontSize="small" />,
    color:  '#E53935',
  },
  {
    format: 'docx',
    label:  'Export as Word (DOCX)',
    icon:   <ArticleRounded fontSize="small" />,
    color:  '#1565C0',
  },
  {
    format: 'markdown',
    label:  'Export as Markdown',
    icon:   <CodeRounded fontSize="small" />,
    color:  '#6A1B9A',
  },
  {
    format: 'json',
    label:  'Export as JSON',
    icon:   <DataObjectRounded fontSize="small" />,
    color:  '#2E7D32',
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExportButtonProps {
  analysisId:  string;
  variant?:    'contained' | 'outlined' | 'text';
  size?:       'small' | 'medium' | 'large';
  /** If true, renders a compact icon-only button */
  compact?:    boolean;
  /** Optionally restrict to a single format */
  format?:     ExportFormat;
  disabled?:   boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ExportButton: React.FC<ExportButtonProps> = ({
  analysisId,
  variant  = 'outlined',
  size     = 'medium',
  compact  = false,
  format,
  disabled = false,
}) => {
  const theme    = useTheme();
  const dispatch = useAppDispatch();
  const jobs     = useAppSelector((s) => s.export.jobs);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const isAnyLoading = Object.values(jobs).some((j) => j.isLoading);

  // ── Trigger a specific format export ──────────────────────────────────────

  const handleExport = useCallback(
    async (fmt: ExportFormat) => {
      setAnchorEl(null);
      dispatch(setAnalysisId(analysisId));

      const thunkMap: Record<ExportFormat, typeof exportPdfThunk> = {
        pdf:      exportPdfThunk,
        docx:     exportDocxThunk,
        markdown: exportMarkdownThunk,
        json:     exportJsonThunk,
      };

      const result = await dispatch(thunkMap[fmt](analysisId));

      if (thunkMap[fmt].fulfilled.match(result)) {
        dispatch(showNotification({
          message:  `Successfully exported as ${fmt.toUpperCase()}`,
          severity: 'success',
        }));
      } else {
        dispatch(showNotification({
          message:  (result.payload as string) ?? `Export failed`,
          severity: 'error',
        }));
      }
    },
    [analysisId, dispatch],
  );

  // ── Single-format shortcut button ─────────────────────────────────────────

  if (format) {
    const cfg   = FORMAT_CONFIGS.find((c) => c.format === format)!;
    const job   = jobs[format];

    return (
      <Tooltip title={`Download ${format.toUpperCase()}`} arrow>
        <span>
          <Button
            variant={variant}
            size={size}
            disabled={disabled || job.isLoading}
            startIcon={
              job.isLoading
                ? <CircularProgress size={16} thickness={5} />
                : job.lastExportedAt
                ? <CheckCircleRounded fontSize="small" sx={{ color: 'success.main' }} />
                : cfg.icon
            }
            onClick={() => handleExport(format)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {compact ? '' : cfg.label}
          </Button>
        </span>
      </Tooltip>
    );
  }

  // ── Multi-format dropdown ──────────────────────────────────────────────────

  return (
    <>
      <Button
        variant={variant}
        size={size}
        disabled={disabled || isAnyLoading}
        startIcon={
          isAnyLoading
            ? <CircularProgress size={16} thickness={5} />
            : <FileDownloadRounded />
        }
        endIcon={<KeyboardArrowDownRounded />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ textTransform: 'none', fontWeight: 600 }}
      >
        {compact ? 'Export' : 'Export Results'}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          elevation: 4,
          sx: { mt: 0.5, minWidth: 220, borderRadius: 2 },
        }}
      >
        <Typography
          sx={{
            px: 2, pt: 1.5, pb: 0.5,
            fontSize: '0.7rem', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'text.disabled',
          }}
        >
          Download Format
        </Typography>
        <Divider sx={{ mb: 0.5 }} />

        {FORMAT_CONFIGS.map((cfg) => {
          const job     = jobs[cfg.format];
          const loading = job.isLoading;
          const done    = Boolean(job.lastExportedAt);

          return (
            <MenuItem
              key={cfg.format}
              onClick={() => handleExport(cfg.format)}
              disabled={loading}
              sx={{
                py: 1, px: 2,
                '&:hover': { background: alpha(cfg.color, 0.06) },
              }}
            >
              <ListItemIcon sx={{ color: cfg.color, minWidth: 36 }}>
                {loading
                  ? <CircularProgress size={18} thickness={5} sx={{ color: cfg.color }} />
                  : done
                  ? <CheckCircleRounded fontSize="small" sx={{ color: 'success.main' }} />
                  : cfg.icon}
              </ListItemIcon>
              <ListItemText
                primary={cfg.label}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: done ? 700 : 500,
                  color: done ? theme.palette.success.main : 'text.primary',
                }}
                secondary={done ? `Downloaded just now` : undefined}
                secondaryTypographyProps={{ fontSize: '0.7rem' }}
              />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
};
