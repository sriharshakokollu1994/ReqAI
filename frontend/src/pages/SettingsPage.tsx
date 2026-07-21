import React, { useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Stack,
  Switch, FormControlLabel, Avatar, Chip, Alert, MenuItem, Divider,
  Select, InputLabel, FormControl, Tab, Tabs, useTheme, alpha,
  InputAdornment, IconButton,
  CircularProgress,
} from '@mui/material';
import {
  PersonRounded,
  SecurityRounded,
  TuneRounded,
  NotificationsRounded,
  SaveRounded,
  VisibilityRounded,
  VisibilityOffRounded,
  DarkModeRounded,
  LightModeRounded,
  AutoAwesomeRounded as AIIcon,
  CheckCircleRounded,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { showNotification } from '../features/notifications/notificationSlice';
import { toggleColorMode } from '../features/ui/uiSlice';
import { updateProfileThunk, clearError } from '../features/auth/authSlice';
import { apiClient } from '../services/apiClient';
import { PageHeader } from '../components/shared/PageHeader';

export const SettingsPage: React.FC = () => {
  const theme    = useTheme();
  const isDark   = theme.palette.mode === 'dark';
  const dispatch = useAppDispatch();
  const { user, isLoading: authLoading, error: authError } = useAppSelector((s) => s.auth);

  const [activeTab, setActiveTab] = useState(0);

  // Profile form
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName,  setLastName]  = useState(user?.lastName  ?? '');
  const [jobTitle,  setJobTitle]  = useState(user?.jobTitle  ?? '');
  const [department, setDepartment] = useState(user?.department ?? '');

  // Password form
  const [currentPw,  setCurrentPw]  = useState('');
  const [newPw,      setNewPw]      = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [showPw,     setShowPw]     = useState(false);
  const [pwSaving,   setPwSaving]   = useState(false);

  // AI prefs
  const [aiMode,     setAiMode]     = useState('standard');
  const [autoSave,   setAutoSave]   = useState(true);
  const [showCost,   setShowCost]   = useState(true);
  const [desktopNot, setDesktopNot] = useState(false);

  const initials   = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : '?';
  const pwMismatch = confirmPw.length > 0 && confirmPw !== newPw;

  const handleProfileSave = async () => {
    const result = await dispatch(updateProfileThunk({
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      jobTitle:  jobTitle.trim()  || undefined,
      department: department.trim() || undefined,
    }));
    if (updateProfileThunk.fulfilled.match(result)) {
      dispatch(showNotification({ message: 'Profile updated successfully', severity: 'success' }));
    } else {
      dispatch(showNotification({ message: (result.payload as string) ?? 'Update failed', severity: 'error' }));
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPw || !newPw || pwMismatch) return;
    setPwSaving(true);
    try {
      await apiClient.post('/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
      dispatch(showNotification({ message: 'Password changed successfully', severity: 'success' }));
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: any) {
      dispatch(showNotification({
        message:  err.response?.data?.error?.message ?? 'Password change failed',
        severity: 'error',
      }));
    } finally {
      setPwSaving(false);
    }
  };

  const TABS = [
    { label: 'Profile',       icon: <PersonRounded fontSize="small" />       },
    { label: 'Security',      icon: <SecurityRounded fontSize="small" />      },
    { label: 'AI & Display',  icon: <TuneRounded fontSize="small" />          },
    { label: 'Notifications', icon: <NotificationsRounded fontSize="small" /> },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900 }}>
      <PageHeader
        title="Settings"
        subtitle="Manage your account, security, and preferences"
        icon={<TuneRounded />}
      />

      <Card>
        {/* Tab navigation */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {TABS.map((t, i) => (
              <Tab
                key={i}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    {t.icon}
                    <span>{t.label}</span>
                  </Box>
                }
              />
            ))}
          </Tabs>
        </Box>

        <CardContent sx={{ p: 3 }}>
          {/* ── Profile tab ─────────────────────────────────────────────── */}
          {activeTab === 0 && (
            <Stack spacing={3}>
              {/* Avatar section */}
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 2.5, p: 2.5,
                borderRadius: 2,
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
              }}>
                <Avatar sx={{
                  width: 72, height: 72, flexShrink: 0,
                  background: 'linear-gradient(135deg, #6C63FF, #8A85FF)',
                  fontSize: '1.375rem', fontWeight: 700,
                }}>
                  {initials}
                </Avatar>
                <Box>
                  <Typography variant="h4" fontWeight={700}>
                    {user?.firstName} {user?.lastName}
                  </Typography>
                  <Chip label={user?.role?.replace(/_/g, ' ')} color="primary" size="small" sx={{ mt: 0.5 }} />
                  <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                    {user?.email}
                  </Typography>
                </Box>
              </Box>

              {authError && (
                <Alert severity="error" onClose={() => dispatch(clearError())}>{authError}</Alert>
              )}

              <Box>
                <Typography variant="overline" color="text.secondary" gutterBottom display="block">
                  Personal Information
                </Typography>
                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      label="First Name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      fullWidth
                    />
                    <TextField
                      label="Last Name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      fullWidth
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      label="Job Title"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      fullWidth
                      size="small"
                    />
                    <TextField
                      label="Department"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      fullWidth
                      size="small"
                    />
                  </Box>
                  <TextField
                    label="Email Address"
                    type="email"
                    value={user?.email ?? ''}
                    disabled
                    fullWidth
                    helperText="Email changes require contacting an administrator"
                  />
                  <Box>
                    <Button
                      variant="contained"
                      startIcon={authLoading ? <CircularProgress size={14} color="inherit" /> : <SaveRounded />}
                      disabled={authLoading || !firstName.trim() || !lastName.trim()}
                      onClick={handleProfileSave}
                    >
                      {authLoading ? 'Saving…' : 'Save changes'}
                    </Button>
                  </Box>
                </Stack>
              </Box>
            </Stack>
          )}

          {/* ── Security tab ─────────────────────────────────────────────── */}
          {activeTab === 1 && (
            <Stack spacing={3}>
              <Alert severity="info">
                Use a strong, unique password. We recommend at least 16 characters with mixed case, numbers, and symbols.
              </Alert>

              <Box>
                <Typography variant="overline" color="text.secondary" gutterBottom display="block">Change Password</Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Current Password"
                    type={showPw ? 'text' : 'password'}
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    fullWidth
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowPw(!showPw)}>
                            {showPw ? <VisibilityOffRounded fontSize="small" /> : <VisibilityRounded fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <TextField
                    label="New Password"
                    type={showPw ? 'text' : 'password'}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    fullWidth
                    helperText="Minimum 8 characters"
                  />
                  <TextField
                    label="Confirm New Password"
                    type={showPw ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    fullWidth
                    error={pwMismatch}
                    helperText={pwMismatch ? 'Passwords do not match' : ' '}
                  />
                  <Box>
                    <Button
                      variant="contained"
                      disabled={!currentPw || !newPw || !confirmPw || pwMismatch || pwSaving}
                      endIcon={pwSaving ? <CircularProgress size={14} color="inherit" /> : undefined}
                      onClick={handlePasswordChange}
                    >
                      {pwSaving ? 'Changing…' : 'Change password'}
                    </Button>
                  </Box>
                </Stack>
              </Box>

              <Divider />

              <Box>
                <Typography variant="overline" color="text.secondary" gutterBottom display="block">Sessions</Typography>
                <Alert severity="success" icon={<CheckCircleRounded />}>
                  You are currently signed in from one active session.
                </Alert>
              </Box>
            </Stack>
          )}

          {/* ── AI & Display tab ─────────────────────────────────────────── */}
          {activeTab === 2 && (
            <Stack spacing={3}>
              {/* Dark mode toggle */}
              <Box>
                <Typography variant="overline" color="text.secondary" gutterBottom display="block">Appearance</Typography>
                <Box sx={{
                  p: 2.5, borderRadius: 2,
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {isDark ? <DarkModeRounded sx={{ color: 'primary.main' }} /> : <LightModeRounded sx={{ color: 'warning.main' }} />}
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {isDark ? 'Dark Mode' : 'Light Mode'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {isDark ? 'Currently using dark theme' : 'Currently using light theme'}
                      </Typography>
                    </Box>
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={isDark ? <LightModeRounded fontSize="small" /> : <DarkModeRounded fontSize="small" />}
                    onClick={() => dispatch(toggleColorMode())}
                  >
                    Switch to {isDark ? 'light' : 'dark'}
                  </Button>
                </Box>
              </Box>

              <Divider />

              {/* AI provider info */}
              <Box>
                <Typography variant="overline" color="text.secondary" gutterBottom display="block">AI Configuration</Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                  AI provider settings are managed by your administrator via environment configuration.
                </Alert>
                <Box sx={{
                  p: 2, borderRadius: 2,
                  background: `linear-gradient(135deg, ${alpha('#6C63FF', isDark ? 0.15 : 0.07)}, ${alpha('#8A85FF', isDark ? 0.08 : 0.04)})`,
                  border: `1px solid ${alpha('#6C63FF', 0.25)}`,
                  display: 'flex', alignItems: 'center', gap: 1.5,
                }}>
                  <AIIcon sx={{ color: 'primary.main' }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={700}>OpenAI GPT-4o</Typography>
                    <Typography variant="caption" color="text.secondary">Active provider · JSON mode enabled</Typography>
                  </Box>
                  <Chip label="Active" color="success" size="small" />
                </Box>
              </Box>

              <Divider />

              {/* Analysis preferences */}
              <Box>
                <Typography variant="overline" color="text.secondary" gutterBottom display="block">Analysis Preferences</Typography>
                <Stack spacing={2}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Default analysis mode</InputLabel>
                    <Select value={aiMode} onChange={(e) => setAiMode(e.target.value)} label="Default analysis mode">
                      <MenuItem value="standard">Standard — all 9 artifact types</MenuItem>
                      <MenuItem value="quick">Quick — summary + user stories only</MenuItem>
                      <MenuItem value="deep">Deep — full + extended test scenarios</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControlLabel
                    control={<Switch checked={autoSave} onChange={(e) => setAutoSave(e.target.checked)} />}
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight={500}>Auto-save analyses on completion</Typography>
                        <Typography variant="caption" color="text.secondary">Automatically add to your saved library</Typography>
                      </Box>
                    }
                  />

                  <FormControlLabel
                    control={<Switch checked={showCost} onChange={(e) => setShowCost(e.target.checked)} />}
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight={500}>Show AI cost estimates</Typography>
                        <Typography variant="caption" color="text.secondary">Display token usage and cost per analysis</Typography>
                      </Box>
                    }
                  />

                  <Box>
                    <Button
                      variant="contained"
                      startIcon={<SaveRounded />}
                      onClick={() => dispatch(showNotification({ message: 'Preferences saved', severity: 'success' }))}
                    >
                      Save preferences
                    </Button>
                  </Box>
                </Stack>
              </Box>
            </Stack>
          )}

          {/* ── Notifications tab ─────────────────────────────────────────── */}
          {activeTab === 3 && (
            <Stack spacing={2.5}>
              <Typography variant="overline" color="text.secondary" display="block">Notification Preferences</Typography>

              {[
                { label: 'Analysis completed',    sub: 'Get notified when an AI analysis finishes',           checked: true  },
                { label: 'Analysis failed',        sub: 'Alert when an analysis job fails',                   checked: true  },
                { label: 'Desktop notifications',  sub: 'Show browser notifications for completed analyses',  checked: desktopNot, onChange: setDesktopNot },
                { label: 'Weekly digest email',    sub: 'Summary of your analysis activity every Monday',     checked: false },
                { label: 'Team activity',          sub: 'Notify when teammates run analyses in your projects',checked: false },
              ].map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    p: 2, borderRadius: 2,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
                  }}
                >
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{item.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.sub}</Typography>
                  </Box>
                  <Switch
                    checked={item.checked}
                    onChange={item.onChange ? (e) => item.onChange!(e.target.checked) : undefined}
                  />
                </Box>
              ))}

              <Box sx={{ pt: 1 }}>
                <Button
                  variant="contained"
                  startIcon={<SaveRounded />}
                  onClick={() => dispatch(showNotification({ message: 'Notification preferences saved', severity: 'success' }))}
                >
                  Save preferences
                </Button>
              </Box>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
