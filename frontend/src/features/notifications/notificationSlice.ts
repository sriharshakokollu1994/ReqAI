import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type Severity = 'success' | 'error' | 'warning' | 'info';

interface Notification {
  id:       string;
  message:  string;
  severity: Severity;
}

interface NotificationState {
  items: Notification[];
}

const initialState: NotificationState = { items: [] };

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    showNotification(state, action: PayloadAction<{ message: string; severity?: Severity }>) {
      state.items.push({
        id:       crypto.randomUUID(),
        message:  action.payload.message,
        severity: action.payload.severity ?? 'info',
      });
    },
    dismissNotification(state, action: PayloadAction<string>) {
      state.items = state.items.filter((n) => n.id !== action.payload);
    },
    clearAll(state) {
      state.items = [];
    },
  },
});

export const { showNotification, dismissNotification, clearAll } = notificationSlice.actions;
export default notificationSlice.reducer;
