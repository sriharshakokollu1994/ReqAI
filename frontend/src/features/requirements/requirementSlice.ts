import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from '../../services/apiClient';
import {
  Requirement, RequirementType, RequirementPriority, RequirementStatus,
  PaginatedResponse, ApiResponse,
} from '../../types';

// ── Query params ──────────────────────────────────────────────────────────────

export interface RequirementQuery {
  page?:     number;
  limit?:    number;
  search?:   string;
  status?:   RequirementStatus;
  type?:     RequirementType;
  priority?: RequirementPriority;
  sortBy?:   string;
  sortDir?:  'asc' | 'desc';
}

export interface CreateRequirementDto {
  title:     string;
  body:      string;
  type:      RequirementType;
  priority:  RequirementPriority;
  tags?:     string[];
  source?:   string;
}

export interface UpdateRequirementDto extends Partial<CreateRequirementDto> {
  status?: RequirementStatus;
}

// ── State ─────────────────────────────────────────────────────────────────────

interface RequirementState {
  items:          Requirement[];
  selected:       Requirement | null;
  total:          number;
  page:           number;
  limit:          number;
  isLoading:      boolean;
  isSaving:       boolean;
  error:          string | null;
  activeProjectId: string | null;
}

const initialState: RequirementState = {
  items:           [],
  selected:        null,
  total:           0,
  page:            1,
  limit:           20,
  isLoading:       false,
  isSaving:        false,
  error:           null,
  activeProjectId: null,
};

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchRequirementsThunk = createAsyncThunk(
  'requirements/fetchAll',
  async ({ projectId, query }: { projectId: string; query?: RequirementQuery }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.get<PaginatedResponse<Requirement>>(
        `/projects/${projectId}/requirements`,
        { params: query },
      );
      return data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error?.message ?? 'Failed to fetch requirements');
    }
  },
);

export const fetchRequirementThunk = createAsyncThunk(
  'requirements/fetchOne',
  async ({ projectId, id }: { projectId: string; id: string }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.get<ApiResponse<Requirement>>(
        `/projects/${projectId}/requirements/${id}`,
      );
      return data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error?.message ?? 'Failed to fetch requirement');
    }
  },
);

export const createRequirementThunk = createAsyncThunk(
  'requirements/create',
  async ({ projectId, dto }: { projectId: string; dto: CreateRequirementDto }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.post<ApiResponse<Requirement>>(
        `/projects/${projectId}/requirements`,
        dto,
      );
      return data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error?.message ?? 'Failed to create requirement');
    }
  },
);

export const updateRequirementThunk = createAsyncThunk(
  'requirements/update',
  async (
    { projectId, id, dto }: { projectId: string; id: string; dto: UpdateRequirementDto },
    { rejectWithValue },
  ) => {
    try {
      const { data } = await apiClient.patch<ApiResponse<Requirement>>(
        `/projects/${projectId}/requirements/${id}`,
        dto,
      );
      return data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error?.message ?? 'Failed to update requirement');
    }
  },
);

export const deleteRequirementThunk = createAsyncThunk(
  'requirements/delete',
  async ({ projectId, id }: { projectId: string; id: string }, { rejectWithValue }) => {
    try {
      await apiClient.delete(`/projects/${projectId}/requirements/${id}`);
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error?.message ?? 'Failed to delete requirement');
    }
  },
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const requirementSlice = createSlice({
  name: 'requirements',
  initialState,
  reducers: {
    setActiveProject(state, action: PayloadAction<string>) {
      state.activeProjectId = action.payload;
    },
    setSelected(state, action: PayloadAction<Requirement | null>) {
      state.selected = action.payload;
    },
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      // fetchAll
      .addCase(fetchRequirementsThunk.pending,   (s) => { s.isLoading = true;  s.error = null; })
      .addCase(fetchRequirementsThunk.fulfilled, (s, a) => {
        s.isLoading = false;
        s.items     = a.payload.data;
        s.total     = a.payload.meta.total;
        s.page      = a.payload.meta.page;
        s.limit     = a.payload.meta.limit;
      })
      .addCase(fetchRequirementsThunk.rejected, (s, a) => {
        s.isLoading = false;
        s.error     = a.payload as string;
      })

      // fetchOne
      .addCase(fetchRequirementThunk.pending,   (s) => { s.isLoading = true; })
      .addCase(fetchRequirementThunk.fulfilled, (s, a) => {
        s.isLoading = false;
        s.selected  = a.payload;
      })
      .addCase(fetchRequirementThunk.rejected,  (s, a) => {
        s.isLoading = false;
        s.error     = a.payload as string;
      })

      // create
      .addCase(createRequirementThunk.pending,   (s) => { s.isSaving = true;  s.error = null; })
      .addCase(createRequirementThunk.fulfilled, (s, a) => {
        s.isSaving = false;
        s.items.unshift(a.payload);
        s.total   += 1;
      })
      .addCase(createRequirementThunk.rejected,  (s, a) => {
        s.isSaving = false;
        s.error    = a.payload as string;
      })

      // update
      .addCase(updateRequirementThunk.pending,   (s) => { s.isSaving = true; })
      .addCase(updateRequirementThunk.fulfilled, (s, a) => {
        s.isSaving = false;
        const idx  = s.items.findIndex((r) => r.id === a.payload.id);
        if (idx !== -1) s.items[idx] = a.payload;
        if (s.selected?.id === a.payload.id) s.selected = a.payload;
      })
      .addCase(updateRequirementThunk.rejected,  (s, a) => {
        s.isSaving = false;
        s.error    = a.payload as string;
      })

      // delete
      .addCase(deleteRequirementThunk.pending,   (s) => { s.isSaving = true; })
      .addCase(deleteRequirementThunk.fulfilled, (s, a) => {
        s.isSaving = false;
        s.items    = s.items.filter((r) => r.id !== a.payload);
        s.total   -= 1;
        if (s.selected?.id === a.payload) s.selected = null;
      })
      .addCase(deleteRequirementThunk.rejected,  (s, a) => {
        s.isSaving = false;
        s.error    = a.payload as string;
      });
  },
});

export const { setActiveProject, setSelected, clearError } = requirementSlice.actions;
export default requirementSlice.reducer;
