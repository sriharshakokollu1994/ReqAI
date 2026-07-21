import React from 'react';
import { Box, Typography, alpha, useTheme } from '@mui/material';

interface PageHeaderProps {
  title:    string;
  subtitle?: string;
  action?:  React.ReactNode;
  icon?:    React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, action, icon }) => {
  const theme  = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{
      display:         'flex',
      alignItems:      { xs: 'flex-start', sm: 'center' },
      flexDirection:   { xs: 'column', sm: 'row' },
      justifyContent:  'space-between',
      gap:             2,
      mb:              3,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {icon && (
          <Box sx={{
            width:        42, height: 42, borderRadius: 2,
            background:   isDark
              ? `linear-gradient(135deg, ${alpha('#6C63FF', 0.25)}, ${alpha('#8A85FF', 0.15)})`
              : `linear-gradient(135deg, ${alpha('#6C63FF', 0.12)}, ${alpha('#8A85FF', 0.08)})`,
            display:      'flex', alignItems: 'center', justifyContent: 'center',
            color:        'primary.main',
            border:       `1px solid ${alpha('#6C63FF', 0.25)}`,
            flexShrink:   0,
          }}>
            {icon}
          </Box>
        )}
        <Box>
          <Typography variant="h3" sx={{ mb: subtitle ? 0.25 : 0 }}>{title}</Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
          )}
        </Box>
      </Box>
      {action && <Box>{action}</Box>}
    </Box>
  );
};
