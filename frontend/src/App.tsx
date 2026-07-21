import React, { useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { store } from './app/store';
import { buildTheme } from './config/theme';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { fetchMeThunk } from './features/auth/authSlice';
import { ProtectedRoute }      from './components/auth/ProtectedRoute';
import { AppLayout }           from './components/layout/AppLayout';
import { NotificationStack }   from './components/shared/NotificationStack';
import { LoginPage }           from './pages/LoginPage';
import { DashboardPage }       from './pages/DashboardPage';
import { AnalyzerPage }        from './pages/AnalyzerPage';
import { HistoryPage }         from './pages/HistoryPage';
import { SettingsPage }        from './pages/SettingsPage';
import { SavedPage }           from './pages/SavedPage';
import { ExportPage }          from './pages/ExportPage';
import { AdminPage }           from './pages/AdminPage';
import { ProjectsPage }        from './pages/ProjectsPage';
import { RequirementsPage }    from './pages/RequirementsPage';

// ── Theme-aware wrapper (reads mode from Redux) ───────────────────────────────
const ThemedApp: React.FC = () => {
  const colorMode = useAppSelector((s) => s.ui.colorMode);
  const dispatch  = useAppDispatch();
  const theme     = useMemo(() => buildTheme(colorMode), [colorMode]);

  React.useEffect(() => { dispatch(fetchMeThunk()); }, [dispatch]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<LoginPage />} />

          {/* Protected */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"                                          element={<DashboardPage />}     />
              <Route path="/analyzer"                                           element={<AnalyzerPage />}      />
              <Route path="/history"                                            element={<HistoryPage />}       />
              <Route path="/saved"                                              element={<SavedPage />}         />
              <Route path="/settings"                                           element={<SettingsPage />}      />
              <Route path="/export/:analysisId"                                 element={<ExportPage />}        />
              <Route path="/projects"                                           element={<ProjectsPage />}      />
              <Route path="/projects/:projectId/requirements"                  element={<RequirementsPage />}  />
            </Route>
          </Route>

          {/* ADMIN only route — wrong role → redirect to /dashboard */}
          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route element={<AppLayout />}>
              <Route path="/admin"                  element={<AdminPage />}     />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <NotificationStack />
    </ThemeProvider>
  );
};

// ── Root component ────────────────────────────────────────────────────────────
const App: React.FC = () => (
  <Provider store={store}>
    <ThemedApp />
  </Provider>
);

export default App;
