import { configureStore } from '@reduxjs/toolkit';
import authReducer          from '../features/auth/authSlice';
import projectReducer       from '../features/projects/projectSlice';
import requirementReducer   from '../features/requirements/requirementSlice';
import analysisReducer      from '../features/analysis/analysisSlice';
import notificationReducer  from '../features/notifications/notificationSlice';
import uiReducer            from '../features/ui/uiSlice';
import exportReducer        from '../features/export/exportSlice';
import adminReducer         from '../features/admin/adminSlice';

export const store = configureStore({
  reducer: {
    auth:          authReducer,
    projects:      projectReducer,
    requirements:  requirementReducer,
    analysis:      analysisReducer,
    notifications: notificationReducer,
    ui:            uiReducer,
    export:        exportReducer,
    admin:         adminReducer,
  },
  middleware: (gDM) => gDM({ serializableCheck: false }),
  devTools: import.meta.env.DEV,
});

export type RootState   = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
