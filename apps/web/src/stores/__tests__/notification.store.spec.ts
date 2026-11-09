import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useNotificationStore } from '../notification.store';

const sessionMocks = vi.hoisted(() => ({
  role: null as string | null,
}));

vi.mock('../../features/iam/session.store', () => ({
  useSessionStore: () => ({
    get role() {
      return sessionMocks.role;
    },
  }),
}));

describe('Notification Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    sessionMocks.role = null;
  });

  it('debe comenzar sin notificaciones ni toasts', () => {
    const store = useNotificationStore();

    expect(store.toasts).toHaveLength(0);
    expect(store.waiting).toHaveLength(0);
    expect(store.items).toHaveLength(0);
    expect(store.unread).toBe(0);
    expect(store.currentConfirm).toBeNull();
  });

  it('debe crear un toast correctamente', () => {
    const store = useNotificationStore();

    const id = store.showToast({
      severity: 'success',
      message: 'Operación realizada',
    });

    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0]?.id).toBe(id);
    expect(store.toasts[0]?.message).toBe('Operación realizada');
    expect(store.toasts[0]?.duration).toBe(4000);
  });

  it('debe cerrar un toast por su identificador', () => {
    const store = useNotificationStore();

    const id = store.showToast({
      severity: 'info',
      message: 'Información',
    });

    store.dismissToast(id);

    expect(store.toasts).toHaveLength(0);
  });

  it('debe limpiar todos los toasts y la cola', () => {
    const store = useNotificationStore();

    store.showToast({ severity: 'success', message: 'Aviso 1' });
    store.showToast({ severity: 'info', message: 'Aviso 2' });

    store.clearToasts();

    expect(store.toasts).toHaveLength(0);
    expect(store.waiting).toHaveLength(0);
  });
  it('debe enviar a la cola los toasts que superen el máximo visible', () => {
    const store = useNotificationStore();

    store.showToast({ severity: 'info', message: 'Aviso 1' });
    store.showToast({ severity: 'info', message: 'Aviso 2' });
    store.showToast({ severity: 'info', message: 'Aviso 3' });
    store.showToast({ severity: 'info', message: 'Aviso 4' });

    expect(store.toasts).toHaveLength(3);
    expect(store.waiting).toHaveLength(1);
    expect(store.waiting[0]?.message).toBe('Aviso 4');
  });
  it('debe priorizar las alertas críticas sobre los toasts automáticos', () => {
    const store = useNotificationStore();

    store.showToast({ severity: 'info', message: 'Aviso 1' });
    store.showToast({ severity: 'info', message: 'Aviso 2' });
    store.showToast({ severity: 'info', message: 'Aviso 3' });

    store.showToast({
      severity: 'error',
      message: 'Alerta crítica',
      duration: null,
      priority: true,
    });

    expect(store.toasts).toHaveLength(3);
    expect(store.toasts[0]?.message).toBe('Alerta crítica');
    expect(store.toasts.some((toast) => toast.message === 'Aviso 1')).toBe(false);
  });
  it('debe filtrar las notificaciones según el rol del usuario', () => {
  sessionMocks.role = 'ENFERMERO';

   let store = useNotificationStore();

    store.notify({
      level: 'warning',
      category: 'clinico',
      title: 'Control médico',
      detail: 'Revisar paciente',
      roles: ['MEDICO'],
    });

    expect(store.items).toHaveLength(1);
    expect(store.visible).toHaveLength(0);

    setActivePinia(createPinia());
    sessionMocks.role = 'MEDICO';
 
    store = useNotificationStore();

    store.notify({
      level: 'warning',
      category: 'clinico',
      title: 'Control médico',
      detail: 'Revisar paciente',
      roles: ['MEDICO'],
    });

    expect(store.visible).toHaveLength(1);
  });
  it('debe actualizar el contador al marcar notificaciones como leídas', () => {
    sessionMocks.role = 'MEDICO';

    const store = useNotificationStore();

    const id = store.notify({
      level: 'warning',
      category: 'clinico',
      title: 'Control médico',
      detail: 'Revisar paciente',
      roles: ['MEDICO'],
    });

    expect(store.unread).toBe(1);

    store.markRead(id);

    expect(store.unread).toBe(0);
    expect(store.items[0]?.read).toBe(true);
    expect(store.items[0]?.readAt).not.toBeNull();
  });
});