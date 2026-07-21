import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from '../../services/apiClient';
import { Project, PaginatedResponse, ApiResponse } from '../../types';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface ProjectQuery {
  page?:    number;
  limit?:   number;
  search?:  string;
  status?:  Project['status'] | 'ALL';
  sortBy?:  string;
  sortDir?: 'asc' | 'desc';
}

export interface CreateProjectDto {
  name:         string;
  description?: string;
}

export interface UpdateProjectDto {
  name?:        string;
  description?: string;
  status?:      Project['status'];
}

// ── State ─────────────────────────────────────────────────────────────────────

interface ProjectState {
  items:     Project[];
  selected:  Project | null;
  total:     number;
  page:      number;
  limit:     number;
  isLoading: boolean;
  isSaving:  boolean;
  error:     string | null;
}

const initialState: ProjectState = {
  items:     [],
  selected:  null,
  total:     0,
  page:      1,
  limit:     20,
  isLoading: false,
  isSaving:  false,
  error:     null,
};

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchProjectsThunk = createAsyncThunk(
  'projects/fetchAll',
  async (query: ProjectQuery | undefined = {}, { rejectWithValue }) => {
    try {
      const params = { ...query };
      if (params.status === 'ALL') delete params.status;
      const { data } = await apiClient.get<PaginatedResponse<Project>>('/projects', { params });
      return data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error?.message ?? 'Failed to fetch projects');
    }
  },
);

export const fetchProjectThunk = createAsyncThunk(
  'projects/fetchOne',
  async (id: string, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.get<ApiResponse<Project>>(`/projects/${id}`);
      return data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error?.message ?? 'Failed to fetch project');
    }
  },
);

export const createProjectThunk = createAsyncThunk(
  'projects/create',
  async (dto: CreateProjectDto, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.post<ApiResponse<Project>>('/projects', dto);
      return data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error?.message ?? 'Failed to create project');
    }
  },
);

export const updateProjectThunk = createAsyncThunk(
  'projects/update',
  async ({ id, dto }: { id: string; dto: UpdateProjectDto }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.patch<ApiResponse<Project>>(`/projects/${id}`, dto);
      return data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error?.message ?? 'Failed to update project');
    }
  },
);

export const deleteProjectThunk = createAsyncThunk(
  'projects/delete',
  async (id: string, { rejectWithValue }) => {
    try {
      await apiClient.delete(`/projects/${id}`);
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error?.message ?? 'Failed to delete project');
    }
  },
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const projectSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    setSelected(state, action: PayloadAction<Project | null>) {
      state.selected = action.payload;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchAll
      .addCase(fetchProjectsThunk.pending,   (s) => { s.isLoading = true;  s.error = null; })
      .addCase(fetchProjectsThunk.fulfilled, (s, a) => {
        s.isLoading = false;
        s.items     = a.payload.data;
        s.total     = a.payload.meta.total;
        s.page      = a.payload.meta.page;
        s.limit     = a.payload.meta.limit;
      })
      .addCase(fetchProjectsThunk.rejected,  (s, a) => { s.isLoading = false; s.error = a.payload as string; })

      // fetchOne
      .addCase(fetchProjectThunk.pending,   (s) => { s.isLoading = true; })
      .addCase(fetchProjectThunk.fulfilled, (s, a) => { s.isLoading = false; s.selected = a.payload; })
      .addCase(fetchProjectThunk.rejected,  (s, a) => { s.isLoading = false; s.error = a.payload as string; })

      // create
      .addCase(createProjectThunk.pending,   (s) => { s.isSaving = true;  s.error = null; })
      .addCase(createProjectThunk.fulfilled, (s, a) => {
        s.isSaving = false;
        s.items.unshift(a.payload);
        s.total += 1;
      })
      .addCase(createProjectThunk.rejected,  (s, a) => { s.isSaving = false; s.error = a.payload as string; })

      // update
      .addCase(updateProjectThunk.pending,   (s) => { s.isSaving = true; })
      .addCase(updateProjectThunk.fulfilled, (s, a) => {
        s.isSaving = false;
        const idx  = s.items.findIndex((p) => p.id === a.payload.id);
        if (idx !== -1) s.items[idx] = a.payload;
        if (s.selected?.id === a.payload.id) s.selected = a.payload;
      })
      .addCase(updateProjectThunk.rejected,  (s, a) => { s.isSaving = false; s.error = a.payload as string; })

      // delete
      .addCase(deleteProjectThunk.pending,   (s) => { s.isSaving = true; })
      .addCase(deleteProjectThunk.fulfilled, (s, a) => {
        s.isSaving = false;
        s.items    = s.items.filter((p) => p.id !== a.payload);
        s.total   -= 1;
        if (s.selected?.id === a.payload) s.selected = null;
      })
      .addCase(deleteProjectThunk.rejected,  (s, a) => { s.isSaving = false; s.error = a.payload as string; });
  },
});

export const { setSelected, clearError } = projectSlice.actions;
export default projectSlice.reducer;
