import React from 'react';
import { Alert, Snackbar } from '@mui/material';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { dismissNotification } from '../../features/notifications/notificationSlice';
import { config } from '../../config';

export const NotificationStack: React.FC = () => {
  const dispatch       = useAppDispatch();
  const { items }      = useAppSelector((s) => s.notifications);
  const latest         = items[items.length - 1];

  if (!latest) return null;

  return (
    <Snackbar
      key={latest.id}
      open
      autoHideDuration={config.toastDuration}
      onClose={() => dispatch(dismissNotification(latest.id))}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert
        severity={latest.severity}
        variant="filled"
        onClose={() => dispatch(dismissNotification(latest.id))}
        sx={{ borderRadius: 2 }}
      >
        {latest.message}
      </Alert>
    </Snackbar>
  );
};
