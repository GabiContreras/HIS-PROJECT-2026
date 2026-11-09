import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { useSessionStore } from '../features/iam/session.store';
import { DEDUPE_WINDOW_MS, MAX_VISIBLE_TOASTS, toastDuration } from '../features/feedback/toast-rules';
import type {
  ConfirmOptions,
  ConfirmRequest,
  NotifyInput,
  SystemNotification,
  Toast,
  ToastInput,
} from '../features/feedback/types';

/**
 * Store único de feedback: toasts (acciones propias), notificaciones del sistema (campana)
 * y confirmaciones modales. Se usa desde componentes con `useFeedback()` y desde
 * servicios con `useNotificationStore()`.
 */
export const useNotificationStore = defineStore('notification', () => {
  const session = useSessionStore();

  // ---------- Toasts ----------
  const toasts = ref<Toast[]>([]); // visibles, el más nuevo primero
  const waiting = ref<Toast[]>([]); // en cola cuando ya hay 3 visibles

  function showToast(input: ToastInput): string {
    const now = Date.now();
    if (input.key) {
      const same = toasts.value.find((t) => t.key === input.key && now - t.createdAt < DEDUPE_WINDOW_MS);
      if (same) {
        same.count += 1;
        same.touchedAt = now;
        return same.id;
      }
    }
    const toast: Toast = {
      id: crypto.randomUUID(),
      severity: input.severity,
      message: input.message,
      title: input.title,
      duration:
        input.duration !== undefined ? input.duration : toastDuration(input.severity, input.message, !!input.action),
      key: input.key,
      count: 1,
      action: input.action,
      createdAt: now,
      touchedAt: now,
    };
    placeToast(toast, input.priority === true);
    return toast.id;
  }

  function placeToast(toast: Toast, priority: boolean): void {
    if (toasts.value.length < MAX_VISIBLE_TOASTS) {
      toasts.value.unshift(toast);
      return;
    }
    if (priority) {
      // Reemplaza al más viejo de los que se cierran solos; si todos son fijos, entra primero en la cola.
      for (let i = toasts.value.length - 1; i >= 0; i -= 1) {
        if (toasts.value[i]?.duration !== null) {
          toasts.value.splice(i, 1);
          toasts.value.unshift(toast);
          return;
        }
      }
      waiting.value.unshift(toast);
      return;
    }
    waiting.value.push(toast);
  }

  function dismissToast(id: string): void {
    const index = toasts.value.findIndex((t) => t.id === id);
    if (index < 0) {
      waiting.value = waiting.value.filter((t) => t.id !== id);
      return;
    }
    toasts.value.splice(index, 1);
    const next = waiting.value.shift();
    if (next) {
      const now = Date.now();
      next.createdAt = now;
      next.touchedAt = now;
      toasts.value.unshift(next);
    }
  }

  function clearToasts(): void {
    toasts.value = [];
    waiting.value = [];
  }

  // ---------- Notificaciones del sistema (campana) ----------
  const items = ref<SystemNotification[]>([]);

  const visible = computed(() =>
    items.value.filter(
      (n) => n.source === 'server' || (session.role !== null && (n.roles?.includes(session.role) ?? true)),
    ),
  );
  /** Las críticas sin leer quedan fijadas arriba; el resto, de la más nueva a la más vieja. */
  const sorted = computed(() =>
    [...visible.value].sort((a, b) => {
      const pinA = a.level === 'critical' && !a.read ? 1 : 0;
      const pinB = b.level === 'critical' && !b.read ? 1 : 0;
      return pinB - pinA || b.createdAt.localeCompare(a.createdAt);
    }),
  );
  const unread = computed(() => visible.value.filter((n) => !n.read).length);
  const criticalUnread = computed(() => visible.value.filter((n) => n.level === 'critical' && !n.read).length);

  /** Registra una notificación local; las críticas además muestran un toast que no se cierra solo. */
  function notify(input: NotifyInput): string {
    const notification: SystemNotification = {
      id: crypto.randomUUID(),
      level: input.level,
      category: input.category,
      title: input.title,
      detail: input.detail,
      createdAt: new Date().toISOString(),
      read: false,
      readAt: null,
      link: input.link,
      source: 'local',
      roles: input.roles,
      eventKey: input.key,
    };
    items.value.unshift(notification);

    const escalate = input.toast ?? input.level === 'critical';
    const forMe = !input.roles || (session.role !== null && input.roles.includes(session.role));
    if (escalate && forMe) {
      showToast({
        severity: input.level === 'critical' ? 'error' : input.level === 'warning' ? 'warning' : 'info',
        title: input.title,
        message: input.detail,
        duration: null,
        priority: true,
        key: input.key ?? `notification:${notification.id}`,
      });
    }
    return notification.id;
  }

  function markRead(id: string): void {
    const n = items.value.find((item) => item.id === id);
    if (n && !n.read) {
      n.read = true;
      n.readAt = new Date().toISOString();
    }
  }

  /** Solo cuando la persona lo pide: abrir o cerrar el panel no marca nada como leído. */
  function markAllRead(): void {
    for (const n of visible.value) markRead(n.id);
  }

  function removeNotification(id: string): void {
    items.value = items.value.filter((n) => n.id !== id);
  }

  // ---------- Confirmaciones modales ----------
  const confirmQueue = ref<ConfirmRequest[]>([]);
  const currentConfirm = computed(() => confirmQueue.value[0] ?? null);

  /** Nunca hay dos modales a la vez: los pedidos esperan su turno. */
  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      confirmQueue.value.push({ ...options, id: crypto.randomUUID(), resolve });
    });
  }

  function settleConfirm(confirmed: boolean): void {
    confirmQueue.value.shift()?.resolve(confirmed);
  }

  return {
    toasts,
    waiting,
    showToast,
    dismissToast,
    clearToasts,
    items,
    visible,
    sorted,
    unread,
    criticalUnread,
    notify,
    markRead,
    markAllRead,
    removeNotification,
    currentConfirm,
    confirm,
    settleConfirm,
  };
});
