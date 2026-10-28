import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { useSessionStore } from '../features/iam/session.store';
import type { Role } from '../features/iam/types';

export type NotificationLevel = 'critical' | 'warning' | 'info';

export interface AppNotification {
  id: string;
  level: NotificationLevel;
  title: string;
  detail: string;
  createdAt: string;
  /** Roles que deben ver el aviso (por ejemplo, el médico de guardia). */
  roles: Role[];
  read: boolean;
}

// Reemplaza al bus de eventos del back mientras no haya notificaciones en tiempo real.
export const useNotificationsStore = defineStore('notifications', () => {
  const session = useSessionStore();
  const items = ref<AppNotification[]>([]);

  const visible = computed(() =>
    items.value.filter((n) => session.role !== null && n.roles.includes(session.role)),
  );
  const unread = computed(() => visible.value.filter((n) => !n.read).length);

  function push(input: Pick<AppNotification, 'level' | 'title' | 'detail' | 'roles'>): void {
    items.value.unshift({ ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString(), read: false });
  }

  function markAllRead(): void {
    for (const n of visible.value) n.read = true;
  }

  return { visible, unread, push, markAllRead };
});
