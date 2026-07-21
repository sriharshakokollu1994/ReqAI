import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiClient } from '../../services/apiClient';
import { AdminUser, PaginatedUsers, ApiResponse, UserRole } from '../../types';

// ─── State ────────────────────────────────────────────────────────────────────

interface AdminState {
  users:      AdminUser[];
  meta:       PaginatedUsers['meta'] | null;
  isLoading:  boolean;
  error:      string | null;
  /** Per-row loading state keyed by userId — prevents full-table re-render flicker */
  rowLoading: Record<string, boolean>;
}

const initialState: AdminState = {
  users:      [],
  meta:       null,
  isLoading:  false,
  error:      null,
  rowLoading: {},
};

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const fetchUsersThunk = createAsyncThunk(
  'admin/fetchUsers',
  async (
    params: {
      page?:     number;
      limit?:    number;
      role?:     UserRole;
      isActive?: boolean;
      search?:   string;
    },
    { rejectWithValue },
  ) => {
    try {
      const { data } = await apiClient.get<PaginatedUsers>('/admin/users', { params });
      return data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.error?.message ?? 'Failed to fetch users',
      );
    }
  },
);

export const changeUserRoleThunk = createAsyncThunk(
  'admin/changeUserRole',
  async (
    { userId, role }: { userId: string; role: UserRole },
    { rejectWithValue },
  ) => {
    try {
      const { data } = await apiClient.patch<ApiResponse<AdminUser>>(
        `/admin/users/${userId}/role`,
        { role },
      );
      return data.data;
    } catch (err: any) {
      return rejectWithValue({
        userId,
        message: err.response?.data?.error?.message ?? 'Failed to change role',
      });
    }
  },
);

export const changeUserStatusThunk = createAsyncThunk(
  'admin/changeUserStatus',
  async (
    { userId, isActive }: { userId: string; isActive: boolean },
    { rejectWithValue },
  ) => {
    try {
      const { data } = await apiClient.patch<ApiResponse<AdminUser>>(
        `/admin/users/${userId}/status`,
        { isActive },
      );
      return data.data;
    } catch (err: any) {
      return rejectWithValue({
        userId,
        message: err.response?.data?.error?.message ?? 'Failed to update status',
      });
    }
  },
);

export const deleteUserThunk = createAsyncThunk(
  'admin/deleteUser',
  async (userId: string, { rejectWithValue }) => {
    try {
      await apiClient.delete(`/admin/users/${userId}`);
      return userId;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.error?.message ?? 'Failed to delete user',
      );
    }
  },
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    clearAdminError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // ── fetchUsers ───────────────────────────────────────────────────────────
    builder
      .addCase(fetchUsersThunk.pending,   (s) => { s.isLoading = true; s.error = null; })
      .addCase(fetchUsersThunk.fulfilled, (s, a) => {
        s.isLoading = false;
        s.users     = a.payload.users;
        s.meta      = a.payload.meta;
      })
      .addCase(fetchUsersThunk.rejected,  (s, a) => {
        s.isLoading = false;
        s.error     = a.payload as string;
      });

    // ── changeUserRole ───────────────────────────────────────────────────────
    builder
      .addCase(changeUserRoleThunk.pending,   (s, a) => {
        s.rowLoading[a.meta.arg.userId] = true;
      })
      .addCase(changeUserRoleThunk.fulfilled, (s, a) => {
        delete s.rowLoading[a.payload.id];
        const idx = s.users.findIndex((u) => u.id === a.payload.id);
        if (idx !== -1) s.users[idx] = a.payload;
      })
      .addCase(changeUserRoleThunk.rejected,  (s, a) => {
        const { userId, message } = a.payload as { userId: string; message: string };
        delete s.rowLoading[userId];
        s.error = message;
      });

    // ── changeUserStatus ─────────────────────────────────────────────────────
    builder
      .addCase(changeUserStatusThunk.pending,   (s, a) => {
        s.rowLoading[a.meta.arg.userId] = true;
      })
      .addCase(changeUserStatusThunk.fulfilled, (s, a) => {
        delete s.rowLoading[a.payload.id];
        const idx = s.users.findIndex((u) => u.id === a.payload.id);
        if (idx !== -1) s.users[idx] = a.payload;
      })
      .addCase(changeUserStatusThunk.rejected,  (s, a) => {
        const { userId, message } = a.payload as { userId: string; message: string };
        delete s.rowLoading[userId];
        s.error = message;
      });

    // ── deleteUser ───────────────────────────────────────────────────────────
    builder
      .addCase(deleteUserThunk.pending,   (s, a) => {
        s.rowLoading[a.meta.arg] = true;
      })
      .addCase(deleteUserThunk.fulfilled, (s, a) => {
        delete s.rowLoading[a.payload];
        s.users = s.users.filter((u) => u.id !== a.payload);
        if (s.meta) s.meta.total = Math.max(0, s.meta.total - 1);
      })
      .addCase(deleteUserThunk.rejected,  (s, a) => {
        delete s.rowLoading[a.meta.arg];
        s.error = a.payload as string;
      });
  },
});

export const { clearAdminError } = adminSlice.actions;
export default adminSlice.reducer;
