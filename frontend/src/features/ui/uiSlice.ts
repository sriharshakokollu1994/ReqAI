import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { PaletteMode } from '@mui/material';

interface UiState {
  colorMode:       PaletteMode;
  sidebarOpen:     boolean;
  sidebarMini:     boolean;
  activeProjectId: string;
}

const STORED_MODE = (): PaletteMode => {
  try {
    const v = localStorage.getItem('reqai:colorMode');
    if (v === 'dark' || v === 'light') return v;
  } catch { /* no-op */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const initialState: UiState = {
  colorMode:       STORED_MODE(),
  sidebarOpen:     true,
  sidebarMini:     false,
  activeProjectId: '00000000-0000-0000-0000-000000000001',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleColorMode(state) {
      state.colorMode = state.colorMode === 'light' ? 'dark' : 'light';
      try { localStorage.setItem('reqai:colorMode', state.colorMode); } catch { /* no-op */ }
    },
    setColorMode(state, action: PayloadAction<PaletteMode>) {
      state.colorMode = action.payload;
      try { localStorage.setItem('reqai:colorMode', action.payload); } catch { /* no-op */ }
    },
    toggleSidebar(state)              { state.sidebarOpen = !state.sidebarOpen; },
    setSidebarOpen(state, a: PayloadAction<boolean>) { state.sidebarOpen = a.payload; },
    toggleSidebarMini(state)          { state.sidebarMini = !state.sidebarMini; },
    setActiveProject(state, a: PayloadAction<string>) { state.activeProjectId = a.payload; },
  },
});

export const {
  toggleColorMode, setColorMode,
  toggleSidebar, setSidebarOpen, toggleSidebarMini,
  setActiveProject,
} = uiSlice.actions;

export default uiSlice.reducer;
