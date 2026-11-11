import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { useSessionStore } from '../features/iam/session.store';
import { listMyNotifications, markNotificationRead, type RemoteNotification } from '../services/notifications';
import { DEDUPE_WINDOW_MS, MAX_VISIBLE_TOASTS, toastDuration } from '../features/feedback/toast-rules';
import type {
  ConfirmOptions,
  ConfirmRequest,
  NotifyInput,
  SystemNotification,
  Toast,
  ToastInput,
} from '../features/feedback/types';

export const useNotificationStore = defineStore('notification', () => {
  const session = useSessionStore();

  const toasts = ref<Toast[]>([]);
  const waiting = ref<Toast[]>([]);

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

  const items = ref<SystemNotification[]>([]);

  const visible = computed(() =>
    items.value.filter(
      (n) => n.source === 'server' || (session.role !== null && (n.roles?.includes(session.role) ?? true)),
    ),
  );
  const sorted = computed(() =>
    [...visible.value].sort((a, b) => {
      const pinA = a.level === 'critical' && !a.read ? 1 : 0;
      const pinB = b.level === 'critical' && !b.read ? 1 : 0;
      return pinB - pinA || b.createdAt.localeCompare(a.createdAt);
    }),
  );
  const unread = computed(() => visible.value.filter((n) => !n.read).length);
  const criticalUnread = computed(() => visible.value.filter((n) => n.level === 'critical' && !n.read).length);

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
      if (n.source === 'server') {
        void markNotificationRead(id).catch(() => {
          n.read = false;
          n.readAt = null;
        });
      }
    }
  }

  const SERVER_CATEGORY: Record<string, SystemNotification['category']> = {
    SIGNOS_VITALES_ALERTA: 'clinico',
    TRIAGE_RIESGO_VITAL: 'triaje',
  };

  function fromServer(row: RemoteNotification): SystemNotification {
    return {
      id: row.id,
      level: row.prioridad === 'ALTA' ? 'critical' : row.prioridad === 'MEDIA' ? 'warning' : 'info',
      category: SERVER_CATEGORY[row.tipo] ?? 'sistema',
      title: row.prioridad === 'ALTA' ? 'Alta prioridad' : 'Aviso',
      detail: row.mensaje,
      createdAt: row.createdAt,
      read: row.leida,
      readAt: row.leida ? row.createdAt : null,
      source: 'server',
    };
  }

  async function syncFromServer(): Promise<void> {
    try {
      const rows = await listMyNotifications();
      items.value = [...items.value.filter((n) => n.source !== 'server'), ...rows.map(fromServer)];
    } catch {
    }
  }

  function markAllRead(): void {
    for (const n of visible.value) markRead(n.id);
  }

  function removeNotification(id: string): void {
    items.value = items.value.filter((n) => n.id !== id);
  }

  const confirmQueue = ref<ConfirmRequest[]>([]);
  const currentConfirm = computed(() => confirmQueue.value[0] ?? null);

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
    syncFromServer,
    removeNotification,
    currentConfirm,
    confirm,
    settleConfirm,
  };
});
