import React, { useState } from 'react';
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Tooltip, Avatar, Typography, Divider, IconButton, Menu, MenuItem,
  AppBar, Toolbar, Badge, useMediaQuery, useTheme, alpha,
} from '@mui/material';
import {
  DashboardRounded as DashboardIcon,
  PsychologyRounded as AnalyzerIcon,
  HistoryRounded as HistoryIcon,
  BookmarkRounded as SavedIcon,
  SettingsRounded as SettingsIcon,
  AdminPanelSettingsRounded as AdminIcon,
  FolderRounded as ProjectsIcon,
  AutoAwesomeRounded as BrandIcon,
  MenuRounded as MenuIcon,
  ChevronLeftRounded,
  ChevronRightRounded,
  DarkModeRounded,
  LightModeRounded,
  NotificationsRounded,
  LogoutRounded,
  AccountCircleRounded,
  KeyboardArrowDownRounded,
} from '@mui/icons-material';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { logoutThunk } from '../../features/auth/authSlice';
import { toggleColorMode, toggleSidebarMini } from '../../features/ui/uiSlice';

const DRAWER_FULL = 240;
const DRAWER_MINI = 68;

interface NavItem { label: string; path: string; icon: React.ReactNode; badge?: number }

const NAV: NavItem[] = [
  { label: 'Dashboard',    path: '/dashboard', icon: <DashboardIcon /> },
  { label: 'Analyzer',     path: '/analyzer',  icon: <AnalyzerIcon />  },
  { label: 'Projects',     path: '/projects',  icon: <ProjectsIcon />  },
  { label: 'History',      path: '/history',   icon: <HistoryIcon />   },
  { label: 'Saved',        path: '/saved',     icon: <SavedIcon />     },
  { label: 'Settings',     path: '/settings',  icon: <SettingsIcon />  },
];

/** Admin-only nav items rendered beneath the main NAV list. */
const ADMIN_NAV: NavItem[] = [
  { label: 'Admin',      path: '/admin',     icon: <AdminIcon />     },
];

export const AppLayout: React.FC = () => {
  const theme       = useTheme();
  const isDark      = theme.palette.mode === 'dark';
  const isMobile    = useMediaQuery(theme.breakpoints.down('md'));
  const navigate    = useNavigate();
  const location    = useLocation();
  const dispatch    = useAppDispatch();
  const { user }        = useAppSelector((s) => s.auth);
  const { sidebarMini } = useAppSelector((s) => s.ui);
  const isAdmin         = user?.role === 'ADMIN';

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl,   setAnchorEl]   = useState<null | HTMLElement>(null);

  const mini = !isMobile && sidebarMini;
  const drawerWidth = mini ? DRAWER_MINI : DRAWER_FULL;
  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : '?';

  const handleNav = (path: string) => { navigate(path); setMobileOpen(false); };
  const handleLogout = async () => {
    setAnchorEl(null);
    await dispatch(logoutThunk());
    navigate('/login');
  };

  // ── Brand logo ───────────────────────────────────────────────────────────────
  const Logo = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{
        width: 36, height: 36, borderRadius: '10px',
        background: 'linear-gradient(135deg, #6C63FF 0%, #8A85FF 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(108,99,255,0.4)',
        flexShrink: 0,
      }}>
        <BrandIcon sx={{ color: '#fff', fontSize: 20 }} />
      </Box>
      {!mini && (
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: '1.0625rem', lineHeight: 1, letterSpacing: '-0.01em', color: theme.palette.text.primary }}>
            ReqAI
          </Typography>
          <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.palette.text.secondary }}>
            AI Analyzer
          </Typography>
        </Box>
      )}
    </Box>
  );

  // ── Drawer content ────────────────────────────────────────────────────────────
  const DrawerContent = () => (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{
        px: mini ? 1.5 : 2, py: 2,
        display: 'flex', alignItems: 'center',
        justifyContent: mini ? 'center' : 'space-between',
        borderBottom: `1px solid ${theme.palette.divider}`,
        minHeight: 64,
      }}>
        <Logo />
        {!isMobile && !mini && (
          <IconButton size="small" onClick={() => dispatch(toggleSidebarMini())} sx={{ color: 'text.secondary' }}>
            <ChevronLeftRounded fontSize="small" />
          </IconButton>
        )}
        {!isMobile && mini && (
          <IconButton size="small" onClick={() => dispatch(toggleSidebarMini())} sx={{ mt: 1, color: 'text.secondary' }}>
            <ChevronRightRounded fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Nav section label */}
      {!mini && (
        <Typography sx={{ px: 2.5, pt: 2, pb: 0.5, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.disabled' }}>
          Navigation
        </Typography>
      )}

      {/* Nav items */}
      <List sx={{ flex: 1, px: 1, pt: mini ? 2 : 0.5 }}>
        {NAV.map((item) => {
          const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          return (
            <Tooltip key={item.path} title={mini ? item.label : ''} placement="right" arrow>
              <ListItemButton
                selected={active}
                onClick={() => handleNav(item.path)}
                sx={{
                  mb: 0.5,
                  minHeight: 44,
                  justifyContent: mini ? 'center' : 'flex-start',
                  px: mini ? 1 : 1.5,
                }}
              >
                <ListItemIcon sx={{
                  minWidth: mini ? 0 : 36,
                  color: active ? 'primary.main' : 'text.secondary',
                  justifyContent: 'center',
                }}>
                  {item.badge ? (
                    <Badge badgeContent={item.badge} color="error">{item.icon}</Badge>
                  ) : item.icon}
                </ListItemIcon>
                {!mini && (
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: '0.875rem',
                      fontWeight: active ? 700 : 500,
                      color: active ? 'primary.main' : 'text.primary',
                    }}
                  />
                )}
                {!mini && active && (
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', ml: 0.5, flexShrink: 0 }} />
                )}
              </ListItemButton>
            </Tooltip>
          );
        })}

        {/* Admin-only section */}
        {isAdmin && (
          <>
            {!mini && <Divider sx={{ my: 1 }} />}
            {!mini && (
              <Typography sx={{ px: 2.5, pb: 0.5, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'error.main' }}>
                Admin
              </Typography>
            )}
            {ADMIN_NAV.map((item) => {
              const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
              return (
                <Tooltip key={item.path} title={mini ? item.label : ''} placement="right" arrow>
                  <ListItemButton
                    selected={active}
                    onClick={() => handleNav(item.path)}
                    sx={{
                      mb: 0.5,
                      minHeight: 44,
                      justifyContent: mini ? 'center' : 'flex-start',
                      px: mini ? 1 : 1.5,
                      '&.Mui-selected': { bgcolor: alpha(theme.palette.error.main, 0.1) },
                      '&.Mui-selected:hover': { bgcolor: alpha(theme.palette.error.main, 0.15) },
                    }}
                  >
                    <ListItemIcon sx={{
                      minWidth: mini ? 0 : 36,
                      color: active ? 'error.main' : 'text.secondary',
                      justifyContent: 'center',
                    }}>
                      {item.icon}
                    </ListItemIcon>
                    {!mini && (
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          fontSize: '0.875rem',
                          fontWeight: active ? 700 : 500,
                          color: active ? 'error.main' : 'text.primary',
                        }}
                      />
                    )}
                    {!mini && active && (
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'error.main', ml: 0.5, flexShrink: 0 }} />
                    )}
                  </ListItemButton>
                </Tooltip>
              );
            })}
          </>
        )}
      </List>

      {/* User section */}
      <Divider />
      <Box sx={{ p: 1.5 }}>
        <Box
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1,
            borderRadius: 2,
            cursor: 'pointer',
            transition: 'background 0.15s ease',
            justifyContent: mini ? 'center' : 'flex-start',
            '&:hover': { background: alpha(theme.palette.primary.main, 0.08) },
          }}
        >
          <Avatar sx={{
            width: 34, height: 34, flexShrink: 0,
            background: 'linear-gradient(135deg, #6C63FF, #8A85FF)',
            fontSize: '0.75rem', fontWeight: 700,
          }}>
            {initials}
          </Avatar>
          {!mini && (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.2 }}>
                {user?.firstName} {user?.lastName}
              </Typography>
              <Typography noWrap sx={{ fontSize: '0.7rem', color: 'text.secondary', lineHeight: 1.3 }}>
                {user?.role?.replace(/_/g, ' ')}
              </Typography>
            </Box>
          )}
          {!mini && <KeyboardArrowDownRounded sx={{ color: 'text.secondary', fontSize: 18, flexShrink: 0 }} />}
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Desktop Drawer */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            transition: theme.transitions.create('width', { duration: 200 }),
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              transition: theme.transitions.create('width', { duration: 200 }),
              overflowX: 'hidden',
              boxSizing: 'border-box',
            },
          }}
        >
          <DrawerContent />
        </Drawer>
      )}

      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_FULL } }}
        >
          <DrawerContent />
        </Drawer>
      )}

      {/* Main area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Top bar */}
        <AppBar position="static" elevation={0} sx={{ zIndex: 10 }}>
          <Toolbar sx={{ gap: 1, minHeight: '56px !important', px: { xs: 2, md: 2.5 } }}>
            {isMobile && (
              <IconButton onClick={() => setMobileOpen(true)} size="small">
                <MenuIcon />
              </IconButton>
            )}

            {/* Page title */}
            <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', flex: 1 }}>
              {NAV.find((n) => location.pathname === n.path || location.pathname.startsWith(n.path + '/'))?.label ?? 'ReqAI'}
            </Typography>

            {/* Actions */}
            <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'} arrow>
              <IconButton size="small" onClick={() => dispatch(toggleColorMode())}>
                {isDark ? <LightModeRounded fontSize="small" /> : <DarkModeRounded fontSize="small" />}
              </IconButton>
            </Tooltip>

            <Tooltip title="Notifications" arrow>
              <IconButton size="small">
                <Badge badgeContent={2} color="error">
                  <NotificationsRounded fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>

            {/* Mobile avatar */}
            {isMobile && (
              <Avatar
                onClick={(e) => setAnchorEl(e.currentTarget)}
                sx={{ width: 32, height: 32, background: 'linear-gradient(135deg,#6C63FF,#8A85FF)', fontSize: '0.75rem', cursor: 'pointer' }}
              >
                {initials}
              </Avatar>
            )}
          </Toolbar>
        </AppBar>

        {/* Page content */}
        <Box
          component="main"
          sx={{ flex: 1, overflow: 'auto', backgroundColor: 'background.default' }}
        >
          <Outlet />
        </Box>
      </Box>

      {/* User context menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: 'left', vertical: 'bottom' }}
        anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
      >
        <Box sx={{ px: 2, py: 1.5, mb: 0.5 }}>
          <Typography fontWeight={700} fontSize="0.875rem">{user?.firstName} {user?.lastName}</Typography>
          <Typography fontSize="0.75rem" color="text.secondary">{user?.email}</Typography>
        </Box>
        <Divider sx={{ mb: 0.5 }} />
        <MenuItem onClick={() => { setAnchorEl(null); navigate('/settings'); }}>
          <ListItemIcon><AccountCircleRounded fontSize="small" /></ListItemIcon>
          Profile & Settings
        </MenuItem>
        <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
          <ListItemIcon><LogoutRounded fontSize="small" color="error" /></ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>
    </Box>
  );
};
