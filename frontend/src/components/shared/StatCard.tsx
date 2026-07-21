import React from 'react';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';

interface StatCardProps {
  title:     string;
  value:     React.ReactNode;
  subtitle?: string;
  icon:      React.ReactNode;
  trend?:    { value: number; label: string };
  accent:    string;
  loading?:  boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title, value, subtitle, icon, trend, accent, loading,
}) => {
  const theme  = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{
      p:          2.5,
      borderRadius: 3,
      background:  isDark ? theme.palette.surface.card : '#FFFFFF',
      border:      `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
      boxShadow:   isDark
        ? '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)'
        : '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
      transition:  'transform 0.2s ease, box-shadow 0.2s ease',
      '&:hover':   {
        transform:  'translateY(-2px)',
        boxShadow:  isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.1)',
      },
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Accent glow */}
      <Box sx={{
        position: 'absolute', top: 0, right: 0,
        width: 120, height: 120,
        borderRadius: '50%',
        background: alpha(accent, 0.08),
        transform:  'translate(30%, -30%)',
        pointerEvents: 'none',
      }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Typography variant="body2" color="text.secondary" fontWeight={500}>{title}</Typography>
        <Box sx={{
          width: 40, height: 40, borderRadius: 2,
          background: alpha(accent, isDark ? 0.2 : 0.12),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accent, flexShrink: 0,
        }}>
          {icon}
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ height: 36, borderRadius: 1, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)', width: '60%' }} />
      ) : (
        <Typography sx={{ fontSize: '1.875rem', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', color: 'text.primary' }}>
          {value}
        </Typography>
      )}

      {(subtitle || trend) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
          {trend && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              {trend.value >= 0
                ? <TrendingUp sx={{ fontSize: 14, color: 'success.main' }} />
                : <TrendingDown sx={{ fontSize: 14, color: 'error.main' }} />}
              <Typography variant="caption" sx={{ fontWeight: 700, color: trend.value >= 0 ? 'success.main' : 'error.main' }}>
                {trend.value >= 0 ? '+' : ''}{trend.value}%
              </Typography>
            </Box>
          )}
          {subtitle && (
            <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
          )}
        </Box>
      )}
    </Box>
  );
};
