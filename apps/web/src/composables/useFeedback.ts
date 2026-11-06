import { useNotificationStore } from '../stores/notification.store';
import type { ToastInput, ToastSeverity } from '../features/feedback/types';

type ToastOptions = Omit<ToastInput, 'severity' | 'message'>;

/**
 * Punto de entrada para dar feedback desde cualquier componente o servicio:
 *   toast.success('Turno reservado')
 *   toast.error('No se pudo guardar', { action: { label: 'Reintentar', handler } })
 *   if (await confirm({ title, message, confirmLabel: 'Dar de baja', tone: 'danger' })) { ... }
 *   notify({ level: 'critical', category: 'clinico', title, detail, roles: ['MEDICO'] })
 */
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
