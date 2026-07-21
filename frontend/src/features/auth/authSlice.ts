import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from '../../services/apiClient';
import { User, LoginRequest, RegisterRequest, ApiResponse, UpdateProfileRequest } from '../../types';

interface AuthState {
  user:        User | null;
  accessToken: string | null;
  isLoading:   boolean;
  isInitialized: boolean;  // true after /auth/me attempt on app load
  error:       string | null;
}

const initialState: AuthState = {
  user:          null,
  accessToken:   null,
  isLoading:     false,
  isInitialized: false,
  error:         null,
};

// ── Thunks ───────────────────────────────────────────────────────────────────

export const loginThunk = createAsyncThunk(
  'auth/login',
  async (credentials: LoginRequest, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.post<ApiResponse<{ user: User; accessToken: string; expiresIn: number }>>(
        '/auth/login',
        credentials,
      );
      return data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error?.message ?? 'Login failed');
    }
  },
);

export const registerThunk = createAsyncThunk(
  'auth/register',
  async (payload: RegisterRequest, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.post<ApiResponse<{ user: User; accessToken: string; expiresIn: number }>>(
        '/auth/register',
        payload,
      );
      return data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error?.message ?? 'Registration failed');
    }
  },
);

export const fetchMeThunk = createAsyncThunk(
  'auth/me',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.get<ApiResponse<{ user: User; accessToken: string }>>(
        '/auth/me',
      );
      return data.data;
    } catch {
      return rejectWithValue(null); // silent — user is just not logged in
    }
  },
);

export const logoutThunk = createAsyncThunk('auth/logout', async () => {
  try {
    await apiClient.post('/auth/logout');
  } catch {
    // best-effort
  }
});

export const updateProfileThunk = createAsyncThunk(
  'auth/updateProfile',
  async (payload: UpdateProfileRequest, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.patch<ApiResponse<User>>('/users/me', payload);
      return data.data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.error?.message ?? 'Failed to update profile',
      );
    }
  },
);

// ── Slice ────────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAccessToken(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
    },
    logout(state) {
      state.user        = null;
      state.accessToken = null;
      state.error       = null;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // login
    builder
      .addCase(loginThunk.pending,   (s) => { s.isLoading = true;  s.error = null; })
      .addCase(loginThunk.fulfilled, (s, a) => {
        s.isLoading   = false;
        s.user        = a.payload.user;
        s.accessToken = a.payload.accessToken;
      })
      .addCase(loginThunk.rejected,  (s, a) => {
        s.isLoading = false;
        s.error = a.payload as string;
      });

    // register
    builder
      .addCase(registerThunk.pending,   (s) => { s.isLoading = true;  s.error = null; })
      .addCase(registerThunk.fulfilled, (s, a) => {
        s.isLoading   = false;
        s.user        = a.payload.user;
        s.accessToken = a.payload.accessToken;
      })
      .addCase(registerThunk.rejected,  (s, a) => {
        s.isLoading = false;
        s.error = a.payload as string;
      });

    // me (silent init)
    builder
      .addCase(fetchMeThunk.pending,   (s) => { s.isLoading = true; })
      .addCase(fetchMeThunk.fulfilled, (s, a) => {
        s.isLoading      = false;
        s.isInitialized  = true;
        if (a.payload) {
          s.user        = a.payload.user;
          s.accessToken = a.payload.accessToken;
        }
      })
      .addCase(fetchMeThunk.rejected,  (s) => {
        s.isLoading     = false;
        s.isInitialized = true;
      });

    // logout
    builder.addCase(logoutThunk.fulfilled, (s) => {
      s.user        = null;
      s.accessToken = null;
    });

    // updateProfile
    builder
      .addCase(updateProfileThunk.pending,   (s) => { s.isLoading = true;  s.error = null; })
      .addCase(updateProfileThunk.fulfilled, (s, a) => {
        s.isLoading = false;
        s.user      = a.payload;
      })
      .addCase(updateProfileThunk.rejected,  (s, a) => {
        s.isLoading = false;
        s.error     = a.payload as string;
      });
  },
});

export const { setAccessToken, logout, clearError } = authSlice.actions;
export default authSlice.reducer;
