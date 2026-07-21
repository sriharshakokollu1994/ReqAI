import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { config } from '../config';
import { store } from '../app/store';
import { logout, setAccessToken } from '../features/auth/authSlice';
import { ApiError } from '../types';

// ── In-memory access token store ──────────────────────────────────────────────
// The token is never persisted to localStorage — only kept in Redux state.
// On page reload it is recovered via the /auth/me call using the httpOnly cookie.

let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject:  (err: unknown) => void;
}> = [];

function processQueue(err: unknown, token: string | null) {
  refreshQueue.forEach((p) => (err ? p.reject(err) : p.resolve(token!)));
  refreshQueue = [];
}

// ── Axios instance ─────────────────────────────────────────────────────────────

export const apiClient: AxiosInstance = axios.create({
  baseURL:         config.apiBaseUrl,
  timeout:         30_000,
  withCredentials: true, // required for httpOnly refresh cookie
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach Bearer token ──────────────────────────────────

apiClient.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  const token = store.getState().auth.accessToken;
  if (token && cfg.headers) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

// ── Response interceptor — silent token refresh ────────────────────────────────

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Only intercept 401s that haven't already been retried
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      if (isRefreshing) {
        // Queue concurrent requests while refresh is in-flight
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await apiClient.post<{ data: { accessToken: string } }>(
          '/auth/refresh',
        );
        const newToken = data.data.accessToken;
        store.dispatch(setAccessToken(newToken));
        processQueue(null, newToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        store.dispatch(logout());
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
