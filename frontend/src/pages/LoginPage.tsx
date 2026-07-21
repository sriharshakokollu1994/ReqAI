import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, TextField, Button, Typography, Link,
  InputAdornment, IconButton, Alert, Stack, Divider, Checkbox,
  FormControlLabel, alpha, useTheme, CircularProgress,
} from '@mui/material';
import {
  VisibilityRounded, VisibilityOffRounded,
  AutoAwesomeRounded as BrandIcon,
  EmailRounded, LockRounded, ArrowForwardRounded,
  LightModeRounded, DarkModeRounded,
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { loginThunk, registerThunk, clearError } from '../features/auth/authSlice';
import { toggleColorMode } from '../features/ui/uiSlice';

type AuthMode = 'login' | 'register';

export const LoginPage: React.FC = () => {
  const theme    = useTheme();
  const isDark   = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isLoading, error, user } = useAppSelector((s) => s.auth);

  const [mode,      setMode]      = useState<AuthMode>('login');
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [remember,  setRemember]  = useState(false);

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
    return () => { dispatch(clearError()); };
  }, [user, navigate, dispatch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      dispatch(loginThunk({ email, password }));
    } else {
      dispatch(registerThunk({ firstName, lastName, email, password }));
    }
  };

  const canSubmit = mode === 'login'
    ? email && password
    : firstName && lastName && email && password.length >= 8;

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', position: 'relative',
      background: isDark
        ? 'radial-gradient(ellipse at 20% 50%, rgba(108,99,255,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(0,212,170,0.08) 0%, transparent 50%), #0D0F14'
        : 'radial-gradient(ellipse at 20% 50%, rgba(108,99,255,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(0,212,170,0.05) 0%, transparent 50%), #F4F6FB',
    }}>
      {/* Dark mode toggle */}
      <IconButton
        onClick={() => dispatch(toggleColorMode())}
        sx={{ position: 'absolute', top: 20, right: 20 }}
      >
        {isDark ? <LightModeRounded /> : <DarkModeRounded />}
      </IconButton>

      {/* Left panel — branding */}
      <Box sx={{
        display: { xs: 'none', lg: 'flex' },
        flex: 1, flexDirection: 'column', justifyContent: 'center',
        px: 8, maxWidth: 540,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 5 }}>
          <Box sx={{
            width: 56, height: 56, borderRadius: '16px',
            background: 'linear-gradient(135deg, #6C63FF 0%, #8A85FF 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(108,99,255,0.5)',
          }}>
            <BrandIcon sx={{ color: '#fff', fontSize: 30 }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.5rem', lineHeight: 1, letterSpacing: '-0.02em' }}>ReqAI</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
              AI Requirement Analyzer
            </Typography>
          </Box>
        </Box>

        <Typography variant="h2" sx={{ mb: 2.5, lineHeight: 1.15 }}>
          Transform requirements<br />
          <Box component="span" sx={{ background: 'linear-gradient(135deg, #6C63FF, #8A85FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            into actionable artifacts
          </Box>
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, lineHeight: 1.7 }}>
          AI-powered platform that generates user stories, acceptance criteria, test scenarios,
          risk assessments, and more — instantly.
        </Typography>

        {[
          'User stories & acceptance criteria',
          'Test scenarios & NFR analysis',
          'Risk identification & complexity scoring',
          'Multi-provider AI (OpenAI, Claude, watsonx)',
        ].map((f) => (
          <Box key={f} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <Box sx={{
              width: 20, height: 20, borderRadius: '50%',
              background: alpha('#6C63FF', 0.15),
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main' }} />
            </Box>
            <Typography variant="body2" color="text.secondary">{f}</Typography>
          </Box>
        ))}
      </Box>

      {/* Right panel — form */}
      <Box sx={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        p: { xs: 2, sm: 4 },
      }}>
        <Card sx={{ width: '100%', maxWidth: 420, p: { xs: 1, sm: 2 } }}>
          <CardContent sx={{ p: 3 }}>
            {/* Mobile logo */}
            <Box sx={{ display: { xs: 'flex', lg: 'none' }, alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Box sx={{
                width: 40, height: 40, borderRadius: '12px',
                background: 'linear-gradient(135deg, #6C63FF, #8A85FF)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <BrandIcon sx={{ color: '#fff', fontSize: 22 }} />
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1.125rem' }}>ReqAI</Typography>
            </Box>

            <Typography variant="h3" gutterBottom>
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {mode === 'login'
                ? 'Welcome back — sign in to your workspace'
                : 'Start your free account today'}
            </Typography>

            {error && (
              <Alert severity="error" onClose={() => dispatch(clearError())} sx={{ mb: 2.5 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2}>
                {mode === 'register' && (
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <TextField
                      label="First name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required fullWidth autoFocus
                    />
                    <TextField
                      label="Last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required fullWidth
                    />
                  </Box>
                )}

                <TextField
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  fullWidth
                  autoFocus={mode === 'login'}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailRounded fontSize="small" sx={{ color: 'text.disabled' }} />
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  label="Password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  fullWidth
                  helperText={mode === 'register' ? 'Minimum 8 characters' : undefined}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockRounded fontSize="small" sx={{ color: 'text.disabled' }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowPw(!showPw)} edge="end">
                          {showPw ? <VisibilityOffRounded fontSize="small" /> : <VisibilityRounded fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                {mode === 'login' && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <FormControlLabel
                      control={<Checkbox size="small" checked={remember} onChange={(e) => setRemember(e.target.checked)} />}
                      label={<Typography variant="body2">Remember me</Typography>}
                    />
                    <Link component={RouterLink} to="/forgot-password" variant="body2" color="primary" fontWeight={600}>
                      Forgot password?
                    </Link>
                  </Box>
                )}

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  disabled={isLoading || !canSubmit}
                  endIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <ArrowForwardRounded />}
                  sx={{ mt: 0.5, py: 1.25 }}
                >
                  {isLoading
                    ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                    : (mode === 'login' ? 'Sign in'      : 'Create account')}
                </Button>
              </Stack>
            </Box>

            <Divider sx={{ my: 3 }}><Typography variant="caption" color="text.disabled">or</Typography></Divider>

            <Typography variant="body2" align="center">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <Link
                component="button"
                type="button"
                variant="body2"
                fontWeight={700}
                color="primary"
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); dispatch(clearError()); }}
              >
                {mode === 'login' ? 'Create one free' : 'Sign in'}
              </Link>
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};
