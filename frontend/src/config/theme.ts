import { createTheme, alpha, ThemeOptions } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

// ── Brand tokens ──────────────────────────────────────────────────────────────
const BRAND = {
  primary:   '#6C63FF',
  secondary: '#00D4AA',
  error:     '#FF5C5C',
  warning:   '#FFB020',
  success:   '#14B869',
  info:      '#2196F3',
} as const;

declare module '@mui/material/styles' {
  interface Palette {
    surface: { main: string; card: string; elevated: string };
  }
  interface PaletteOptions {
    surface?: { main?: string; card?: string; elevated?: string };
  }
  interface TypeBackground {
    subtle: string;
  }
}

// ── Shared typography ─────────────────────────────────────────────────────────
const typography: ThemeOptions['typography'] = {
  fontFamily: [
    'Inter',
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    'sans-serif',
  ].join(','),
  h1: { fontWeight: 800, fontSize: '2.5rem',  lineHeight: 1.15, letterSpacing: '-0.02em' },
  h2: { fontWeight: 700, fontSize: '1.875rem',lineHeight: 1.2,  letterSpacing: '-0.015em' },
  h3: { fontWeight: 700, fontSize: '1.375rem',lineHeight: 1.35, letterSpacing: '-0.01em'  },
  h4: { fontWeight: 600, fontSize: '1.125rem',lineHeight: 1.4                              },
  h5: { fontWeight: 600, fontSize: '1rem',    lineHeight: 1.5                              },
  h6: { fontWeight: 600, fontSize: '0.875rem',lineHeight: 1.5                              },
  body1:   { fontSize: '0.9375rem', lineHeight: 1.65 },
  body2:   { fontSize: '0.8125rem', lineHeight: 1.65 },
  caption: { fontSize: '0.75rem',   lineHeight: 1.5  },
  overline: { fontWeight: 700, fontSize: '0.6875rem', letterSpacing: '0.1em', textTransform: 'uppercase' },
};

// ── Build theme for a given mode ──────────────────────────────────────────────
export function buildTheme(mode: PaletteMode) {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary:   { main: BRAND.primary, light: '#8A85FF', dark: '#4B44CC', contrastText: '#FFFFFF' },
      secondary: { main: BRAND.secondary, light: '#4DFFDD', dark: '#00A882', contrastText: '#FFFFFF' },
      error:     { main: BRAND.error,   light: '#FF8A8A', dark: '#CC3333' },
      warning:   { main: BRAND.warning, light: '#FFC94D', dark: '#CC8A00' },
      success:   { main: BRAND.success, light: '#4DD98A', dark: '#0E8A4E' },
      info:      { main: BRAND.info,    light: '#64B5F6', dark: '#1565C0' },
      background: isDark
        ? { default: '#0D0F14', paper: '#161B27', subtle: '#1E2535' }
        : { default: '#F4F6FB', paper: '#FFFFFF',  subtle: '#EEF1F8' },
      text: isDark
        ? { primary: '#E8ECFF', secondary: '#8892B0', disabled: '#4A5568' }
        : { primary: '#0D1117', secondary: '#4A5568', disabled: '#9CA3AF' },
      divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
      surface: {
        main:     isDark ? '#1E2535' : '#F4F6FB',
        card:     isDark ? '#161B27' : '#FFFFFF',
        elevated: isDark ? '#252D3E' : '#FFFFFF',
      },
      action: {
        hover:    isDark ? 'rgba(108,99,255,0.1)' : 'rgba(108,99,255,0.06)',
        selected: isDark ? 'rgba(108,99,255,0.2)' : 'rgba(108,99,255,0.12)',
      },
    },
    typography,
    shape: { borderRadius: 12 },
    shadows: [
      'none',
      isDark ? '0 1px 3px rgba(0,0,0,0.4)'  : '0 1px 3px rgba(0,0,0,0.06)',
      isDark ? '0 2px 6px rgba(0,0,0,0.45)' : '0 2px 6px rgba(0,0,0,0.08)',
      isDark ? '0 4px 12px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.1)',
      isDark ? '0 8px 24px rgba(0,0,0,0.55)': '0 8px 24px rgba(0,0,0,0.12)',
      isDark ? '0 16px 40px rgba(0,0,0,0.6)': '0 16px 40px rgba(0,0,0,0.14)',
      ...Array(19).fill('none'),
    ] as any,
    components: {
      // ── CssBaseline ───────────────────────────────────────────────────────
      MuiCssBaseline: {
        styleOverrides: {
          '*, *::before, *::after': { boxSizing: 'border-box' },
          html: { height: '100%' },
          body: {
            height: '100%',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            scrollbarWidth: 'thin',
            scrollbarColor: isDark ? '#2D3748 transparent' : '#CBD5E0 transparent',
            '&::-webkit-scrollbar':       { width: 6 },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              background: isDark ? '#2D3748' : '#CBD5E0',
              borderRadius: 3,
            },
          },
          '#root': { height: '100%', display: 'flex', flexDirection: 'column' },
        },
      },

      // ── Button ────────────────────────────────────────────────────────────
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight:    600,
            borderRadius:  10,
            padding:       '9px 22px',
            fontSize:      '0.875rem',
            transition:    'all 0.18s ease',
          },
          contained: {
            background:  `linear-gradient(135deg, ${BRAND.primary} 0%, #8A85FF 100%)`,
            boxShadow:   `0 4px 16px ${alpha(BRAND.primary, 0.4)}`,
            '&:hover': {
              background: `linear-gradient(135deg, #5B52E0 0%, ${BRAND.primary} 100%)`,
              boxShadow:  `0 6px 24px ${alpha(BRAND.primary, 0.55)}`,
              transform:  'translateY(-1px)',
            },
            '&:active': { transform: 'translateY(0)' },
            '&.Mui-disabled': { background: isDark ? '#2D3748' : '#E5E7EB', boxShadow: 'none' },
          },
          outlined: {
            borderColor: isDark ? alpha(BRAND.primary, 0.5) : alpha(BRAND.primary, 0.4),
            '&:hover':   { borderColor: BRAND.primary, background: alpha(BRAND.primary, 0.06) },
          },
          text: {
            '&:hover': { background: alpha(BRAND.primary, 0.07) },
          },
          sizeSmall:  { padding: '5px 14px', fontSize: '0.8125rem' },
          sizeLarge:  { padding: '12px 28px', fontSize: '1rem', borderRadius: 12 },
        },
      },

      // ── IconButton ────────────────────────────────────────────────────────
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            transition: 'all 0.18s ease',
            '&:hover': { background: alpha(BRAND.primary, 0.1) },
          },
        },
      },

      // ── Card ──────────────────────────────────────────────────────────────
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderRadius:    14,
            border:          `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            boxShadow:       isDark
              ? '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)'
              : '0 1px 4px rgba(0,0,0,0.06), 0 2px 12px rgba(0,0,0,0.04)',
            transition: 'box-shadow 0.22s ease, transform 0.22s ease',
          },
        },
      },
      MuiCardContent: {
        styleOverrides: { root: { '&:last-child': { paddingBottom: 20 } } },
      },

      // ── Paper ─────────────────────────────────────────────────────────────
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          elevation1: { boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.35)' : '0 1px 4px rgba(0,0,0,0.08)' },
          elevation2: { boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.1)' },
        },
      },

      // ── TextField ─────────────────────────────────────────────────────────
      MuiTextField: {
        defaultProps: { variant: 'outlined', size: 'small' },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            transition: 'box-shadow 0.18s ease',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: BRAND.primary,
            },
            '&.Mui-focused': {
              boxShadow: `0 0 0 3px ${alpha(BRAND.primary, 0.2)}`,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: BRAND.primary,
              borderWidth: 2,
            },
          },
          notchedOutline: {
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)',
          },
        },
      },

      // ── Select ────────────────────────────────────────────────────────────
      MuiSelect: {
        styleOverrides: {
          root: { borderRadius: 10 },
        },
      },

      // ── Chip ──────────────────────────────────────────────────────────────
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius:  8,
            fontWeight:    600,
            fontSize:      '0.75rem',
            height:        26,
          },
          colorPrimary: {
            background: alpha(BRAND.primary, 0.14),
            color:      isDark ? '#A5A0FF' : BRAND.primary,
          },
          colorSuccess: {
            background: alpha(BRAND.success, 0.14),
            color:      isDark ? '#4DD98A' : BRAND.success,
          },
          colorWarning: {
            background: alpha(BRAND.warning, 0.14),
            color:      isDark ? '#FFC94D' : '#B06A00',
          },
          colorError: {
            background: alpha(BRAND.error, 0.14),
            color:      isDark ? '#FF8A8A' : BRAND.error,
          },
          colorInfo: {
            background: alpha(BRAND.info, 0.14),
            color:      isDark ? '#90CAF9' : BRAND.info,
          },
          colorSecondary: {
            background: alpha(BRAND.secondary, 0.14),
            color:      isDark ? '#4DFFDD' : BRAND.secondary,
          },
        },
      },

      // ── LinearProgress ────────────────────────────────────────────────────
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 6, height: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' },
          bar:  { borderRadius: 6 },
          barColorPrimary: {
            background: `linear-gradient(90deg, ${BRAND.primary} 0%, #8A85FF 100%)`,
          },
        },
      },

      // ── Tooltip ───────────────────────────────────────────────────────────
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius:    8,
            fontSize:        '0.75rem',
            backgroundColor: isDark ? '#374151' : '#111827',
            padding:         '6px 12px',
          },
          arrow: { color: isDark ? '#374151' : '#111827' },
        },
      },

      // ── ListItemButton ────────────────────────────────────────────────────
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            transition:   'all 0.15s ease',
            '&.Mui-selected': {
              background:  `linear-gradient(135deg, ${alpha(BRAND.primary, 0.18)} 0%, ${alpha(BRAND.primary, 0.1)} 100%)`,
              color:       BRAND.primary,
              '&:hover':   { background: alpha(BRAND.primary, 0.22) },
            },
            '&:hover': { background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' },
          },
        },
      },

      // ── Drawer ────────────────────────────────────────────────────────────
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: isDark ? '#111520' : '#FFFFFF',
            borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
          },
        },
      },

      // ── AppBar ────────────────────────────────────────────────────────────
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: isDark ? alpha('#111520', 0.9) : alpha('#FFFFFF', 0.9),
            backdropFilter:  'blur(16px)',
            borderBottom:    `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
            color:           isDark ? '#E8ECFF' : '#0D1117',
            boxShadow:       'none',
          },
        },
      },

      // ── Table ─────────────────────────────────────────────────────────────
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-head': {
              fontWeight:      700,
              fontSize:        '0.75rem',
              textTransform:   'uppercase',
              letterSpacing:   '0.06em',
              color:           isDark ? '#8892B0' : '#6B7280',
              background:      isDark ? '#1E2535' : '#F8FAFF',
              borderBottom:    `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              padding:         '10px 14px',
              whiteSpace:      'nowrap',
            },
          },
        },
      },
      MuiTableBody: {
        styleOverrides: {
          root: {
            '& .MuiTableRow-root': {
              transition: 'background 0.15s ease',
              '&:hover': { background: isDark ? 'rgba(108,99,255,0.05)' : 'rgba(108,99,255,0.03)' },
            },
            '& .MuiTableCell-body': {
              borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              padding:     '10px 14px',
            },
          },
        },
      },

      // ── Tabs ──────────────────────────────────────────────────────────────
      MuiTabs: {
        styleOverrides: {
          root:      { minHeight: 40 },
          indicator: {
            height:     3,
            borderRadius: '3px 3px 0 0',
            background: `linear-gradient(90deg, ${BRAND.primary} 0%, #8A85FF 100%)`,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight:    600,
            fontSize:      '0.875rem',
            minHeight:     40,
            padding:       '8px 16px',
            color:         isDark ? '#8892B0' : '#6B7280',
            '&.Mui-selected': { color: BRAND.primary },
          },
        },
      },

      // ── Accordion ─────────────────────────────────────────────────────────
      MuiAccordion: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border:    `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
            borderRadius: '12px !important',
            marginBottom: 8,
            '&::before': { display: 'none' },
            '&.Mui-expanded': { margin: '0 0 8px 0' },
          },
        },
      },
      MuiAccordionSummary: {
        styleOverrides: {
          root: {
            padding:     '4px 16px',
            minHeight:   52,
            borderRadius: 12,
            '&.Mui-expanded': { minHeight: 52 },
          },
          content: {
            margin: '10px 0',
            '&.Mui-expanded': { margin: '10px 0' },
          },
        },
      },
      MuiAccordionDetails: {
        styleOverrides: { root: { padding: '0 16px 16px' } },
      },

      // ── Menu ──────────────────────────────────────────────────────────────
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 12,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.15)',
            minWidth: 180,
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius:  8,
            margin:        '2px 6px',
            fontSize:      '0.875rem',
            '&:hover':     { background: isDark ? 'rgba(108,99,255,0.12)' : 'rgba(108,99,255,0.07)' },
            '&.Mui-selected': { background: alpha(BRAND.primary, 0.12) },
          },
        },
      },

      // ── Badge ─────────────────────────────────────────────────────────────
      MuiBadge: {
        styleOverrides: {
          badge: {
            fontWeight:  700,
            fontSize:    '0.625rem',
            minWidth:    17,
            height:      17,
            padding:     '0 4px',
          },
        },
      },

      // ── Skeleton ──────────────────────────────────────────────────────────
      MuiSkeleton: {
        styleOverrides: {
          root: {
            borderRadius:    8,
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)',
            '&::after': {
              background: isDark
                ? 'linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent)'
                : 'linear-gradient(90deg,transparent,rgba(0,0,0,0.04),transparent)',
            },
          },
        },
      },

      // ── Switch ────────────────────────────────────────────────────────────
      MuiSwitch: {
        styleOverrides: {
          root: { padding: 6 },
          track: {
            borderRadius: 8,
            opacity: 1,
            backgroundColor: isDark ? '#2D3748' : '#CBD5E0',
          },
          thumb: { boxShadow: '0 2px 6px rgba(0,0,0,0.2)' },
          switchBase: {
            '&.Mui-checked': {
              color: '#FFFFFF',
              '& + .MuiSwitch-track': {
                background: `linear-gradient(90deg, ${BRAND.primary}, #8A85FF)`,
                opacity:    1,
              },
            },
          },
        },
      },

      // ── Alert ─────────────────────────────────────────────────────────────
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            border:       '1px solid transparent',
          },
          standardInfo:    { borderColor: alpha(BRAND.info, 0.25) },
          standardSuccess: { borderColor: alpha(BRAND.success, 0.25) },
          standardWarning: { borderColor: alpha(BRAND.warning, 0.25) },
          standardError:   { borderColor: alpha(BRAND.error, 0.25) },
          filledInfo:      { background: BRAND.info },
          filledSuccess:   { background: BRAND.success },
          filledWarning:   { background: BRAND.warning },
          filledError:     { background: BRAND.error },
        },
      },
    },
  });
}

// ── Default export: light theme (for backward compat) ─────────────────────────
export const lightTheme = buildTheme('light');
export const darkTheme  = buildTheme('dark');
