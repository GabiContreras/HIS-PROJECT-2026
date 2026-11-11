import { useNotificationStore } from '../stores/notification.store';
import type { ToastInput, ToastSeverity } from '../features/feedback/types';

type ToastOptions = Omit<ToastInput, 'severity' | 'message'>;

export function useFeedback() {
  const store = useNotificationStore();
  const make =
    (severity: ToastSeverity) =>
    (message: string, options: ToastOptions = {}): string =>
      store.showToast({ ...options, severity, message });

  return {
    toast: {
      success: make('success'),
      info: make('info'),
      warning: make('warning'),
      error: make('error'),
      dismiss: store.dismissToast,
    },
    confirm: store.confirm,
    notify: store.notify,
  };
}
