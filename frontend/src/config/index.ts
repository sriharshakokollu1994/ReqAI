const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export const config = {
  apiBaseUrl:      API_BASE_URL,
  appName:         'ReqAI',
  appVersion:      '1.0.0',
  pollingInterval: 3_000,   // ms — analysis status polling
  maxPollingTime:  300_000, // ms — give up polling after 5 min
  toastDuration:   4_000,   // ms
} as const;
