import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from '../../services/apiClient';
import { Analysis, AnalysisStatus_, Artifact, HistoryItem, PaginatedResponse, ApiResponse } from '../../types';

interface AnalysisState {
  current:        Analysis | null;
  status:         AnalysisStatus_ | null;
  history:        HistoryItem[];
  historyTotal:   number;
  saved:          HistoryItem[];
  savedTotal:     number;
  isLoading:      boolean;
  isTriggering:   boolean;
  isPolling:      boolean;
  error:          string | null;
}

const initialState: AnalysisState = {
  current:      null,
  status:       null,
  history:      [],
  historyTotal: 0,
  saved:        [],
  savedTotal:   0,
  isLoading:    false,
  isTriggering: false,
  isPolling:    false,
  error:        null,
};

// ── Thunks ────────────────────────────────────────────────────────────────────

export const triggerAnalysisThunk = createAsyncThunk(
  'analysis/trigger',
  async (
    {
      projectId, requirementId, context, techStack, domain,
    }: {
      projectId:     string;
      requirementId: string;
      context?:      string;
      techStack?:    string;
      domain?:       string;
    },
    { rejectWithValue },
  ) => {
    try {
      const { data } = await apiClient.post<ApiResponse<{ analysisId: string; status: string; jobId: string; message: string }>>(
        `/projects/${projectId}/requirements/${requirementId}/analyze`,
        { context, techStack, domain },
      );
      return data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error?.message ?? 'Failed to trigger analysis');
    }
  },
);

export const fetchAnalysisThunk = createAsyncThunk(
  'analysis/fetchLatest',
  async ({ projectId, requirementId }: { projectId: string; requirementId: string }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.get<ApiResponse<Analysis>>(
        `/projects/${projectId}/requirements/${requirementId}/analysis`,
      );
      return data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error?.message ?? 'No analysis found');
    }
  },
);

export const pollAnalysisStatusThunk = createAsyncThunk(
  'analysis/pollStatus',
  async ({ projectId, requirementId }: { projectId: string; requirementId: string }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.get<ApiResponse<AnalysisStatus_>>(
        `/projects/${projectId}/requirements/${requirementId}/analysis/status`,
      );
      return data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error?.message ?? 'Failed to poll status');
    }
  },
);

export const fetchHistoryThunk = createAsyncThunk(
  'analysis/fetchHistory',
  async (params: { page?: number; limit?: number }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.get<PaginatedResponse<HistoryItem>>('/history', { params });
      return data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error?.message ?? 'Failed to fetch history');
    }
  },
);

export const fetchSavedThunk = createAsyncThunk(
  'analysis/fetchSaved',
  async (params: { page?: number; limit?: number }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.get<PaginatedResponse<HistoryItem>>('/history/saved', { params });
      return data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error?.message ?? 'Failed to fetch saved analyses');
    }
  },
);

export const saveAnalysisThunk = createAsyncThunk(
  'analysis/save',
  async (
    { projectId, requirementId, note }: { projectId: string; requirementId: string; note?: string },
    { rejectWithValue },
  ) => {
    try {
      await apiClient.post(`/projects/${projectId}/requirements/${requirementId}/analysis/save`, { note });
      return requirementId;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error?.message ?? 'Failed to save analysis');
    }
  },
);

export const rateArtifactThunk = createAsyncThunk(
  'analysis/rateArtifact',
  async ({ artifactId, rating }: { artifactId: string; rating: number }, { rejectWithValue }) => {
    try {
      await apiClient.post(`/artifacts/${artifactId}/rate`, { rating });
      return { artifactId, rating };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error?.message ?? 'Failed to rate artifact');
    }
  },
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const analysisSlice = createSlice({
  name: 'analysis',
  initialState,
  reducers: {
    clearCurrent(state) {
      state.current = null;
      state.status  = null;
      state.error   = null;
    },
    setPolling(state, action: PayloadAction<boolean>) {
      state.isPolling = action.payload;
    },
    updateArtifact(state, action: PayloadAction<Artifact>) {
      if (state.current) {
        const idx = state.current.artifacts.findIndex((a) => a.id === action.payload.id);
        if (idx !== -1) state.current.artifacts[idx] = action.payload;
      }
    },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(triggerAnalysisThunk.pending,   (s) => { s.isTriggering = true;  s.error = null; })
      .addCase(triggerAnalysisThunk.fulfilled, (s) => { s.isTriggering = false; })
      .addCase(triggerAnalysisThunk.rejected,  (s, a) => { s.isTriggering = false; s.error = a.payload as string; })

      .addCase(fetchAnalysisThunk.pending,   (s) => { s.isLoading = true; })
      .addCase(fetchAnalysisThunk.fulfilled, (s, a) => { s.isLoading = false; s.current = a.payload; })
      .addCase(fetchAnalysisThunk.rejected,  (s, a) => { s.isLoading = false; s.error = a.payload as string; })

      .addCase(pollAnalysisStatusThunk.fulfilled, (s, a) => { s.status = a.payload; })

      .addCase(fetchHistoryThunk.pending,   (s) => { s.isLoading = true; })
      .addCase(fetchHistoryThunk.fulfilled, (s, a) => {
        s.isLoading    = false;
        s.history      = a.payload.data;
        s.historyTotal = a.payload.meta.total;
      })
      .addCase(fetchHistoryThunk.rejected,  (s, a) => { s.isLoading = false; s.error = a.payload as string; })

      .addCase(fetchSavedThunk.pending,   (s) => { s.isLoading = true; })
      .addCase(fetchSavedThunk.fulfilled, (s, a) => {
        s.isLoading  = false;
        s.saved      = a.payload.data;
        s.savedTotal = a.payload.meta.total;
      })
      .addCase(fetchSavedThunk.rejected,  (s, a) => { s.isLoading = false; s.error = a.payload as string; })

      .addCase(rateArtifactThunk.fulfilled, (s, a) => {
        if (s.current) {
          const idx = s.current.artifacts.findIndex((ar) => ar.id === a.payload.artifactId);
          if (idx !== -1) s.current.artifacts[idx]!.userRating = a.payload.rating;
        }
      });
  },
});

export const { clearCurrent, setPolling, updateArtifact, clearError } = analysisSlice.actions;
export default analysisSlice.reducer;
