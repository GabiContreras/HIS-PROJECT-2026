<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { timeAgo } from '../../features/feedback/time-ago';
import type { NotificationLevel, SystemNotification } from '../../features/feedback/types';
import { formatDateTime } from '../../shared/format';
import { useNotificationStore } from '../../stores/notification.store';
import AppIcon, { type IconName } from '../ui/AppIcon.vue';

const store = useNotificationStore();
const router = useRouter();
const route = useRoute();

const open = ref(false);
const tab = ref<'todas' | 'sin-leer'>('todas');
const root = ref<HTMLElement | null>(null);
const now = ref(Date.now());
let clock: ReturnType<typeof setInterval> | undefined;
const SERVER_POLL_MS = 30_000;
let serverPoll: ReturnType<typeof setInterval> | undefined;

const ICONS: Record<NotificationLevel, IconName> = { critical: 'alert', warning: 'triangle-alert', info: 'info' };
const list = computed(() => (tab.value === 'sin-leer' ? store.sorted.filter((n) => !n.read) : store.sorted));
const badge = computed(() => (store.unread > 9 ? '9+' : String(store.unread)));
const label = computed(() =>
  store.unread > 0 ? `Notificaciones, ${store.unread} sin leer` : 'Notificaciones, sin novedades',
);

function openItem(n: SystemNotification): void {
  store.markRead(n.id);
  if (n.link) {
    open.value = false;
    void router.push({ name: n.link.name, params: n.link.params });
  }
}

function onDocumentClick(event: MouseEvent): void {
  if (open.value && root.value && !root.value.contains(event.target as Node)) open.value = false;
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) open.value = false;
}

watch(() => route.fullPath, () => (open.value = false));

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onKeydown);
  clock = setInterval(() => (now.value = Date.now()), 30_000);
  void store.syncFromServer();
  serverPoll = setInterval(() => void store.syncFromServer(), SERVER_POLL_MS);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
  document.removeEventListener('keydown', onKeydown);
  if (clock) clearInterval(clock);
  if (serverPoll) clearInterval(serverPoll);
});
</script>

<template>
  <div ref="root" class="bell-wrap">
    <button
      class="bell"
      type="button"
      :aria-label="label"
      aria-haspopup="dialog"
      :aria-expanded="open"
      aria-controls="notification-panel"
      @click="open = !open"
    >
      <AppIcon name="bell" :size="20" />
      <span
        v-if="store.unread > 0"
        :key="store.unread"
        class="badge"
        :class="{ pulse: store.criticalUnread > 0 }"
        aria-hidden="true"
      >{{ badge }}</span>
    </button>

    <section v-if="open" id="notification-panel" class="panel" role="dialog" aria-label="Notificaciones">
      <header class="panel-head">
        <h2>Notificaciones</h2>
        <button class="link" type="button" :disabled="store.unread === 0" @click="store.markAllRead()">
          Marcar todas como leídas
        </button>
      </header>
      <div class="tabs" role="tablist">
        <button role="tab" type="button" :aria-selected="tab === 'todas'" :class="{ on: tab === 'todas' }" @click="tab = 'todas'">Todas</button>
        <button role="tab" type="button" :aria-selected="tab === 'sin-leer'" :class="{ on: tab === 'sin-leer' }" @click="tab = 'sin-leer'">
          Sin leer<span v-if="store.unread > 0" class="tab-count">{{ store.unread }}</span>
        </button>
      </div>

      <p v-if="list.length === 0" class="empty">
        {{ tab === 'sin-leer' ? 'No tenés notificaciones sin leer.' : 'Sin notificaciones.' }}
      </p>
      <ul v-else>
        <li v-for="n in list" :key="n.id" :class="[`lv-${n.level}`, { unread: !n.read }]">
          <button class="main" type="button" @click="openItem(n)">
            <span class="ico" aria-hidden="true"><AppIcon :name="ICONS[n.level]" :size="18" /></span>
            <span class="text">
              <strong>{{ n.title }}</strong>
              <span class="detail">{{ n.detail }}</span>
              <time :datetime="n.createdAt" :title="formatDateTime(n.createdAt)">{{ timeAgo(n.createdAt, now) }}</time>
            </span>
            <span v-if="!n.read" class="dot" aria-label="Sin leer"></span>
          </button>
          <span class="item-actions">
            <button v-if="!n.read" type="button" aria-label="Marcar como leída" title="Marcar como leída" @click="store.markRead(n.id)">
              <AppIcon name="check" :size="15" />
            </button>
            <button type="button" aria-label="Eliminar notificación" title="Eliminar" @click="store.removeNotification(n.id)">
              <AppIcon name="x" :size="15" />
            </button>
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.bell-wrap { position: relative; }
.bell { position: relative; display: grid; place-items: center; padding: 8px 10px; background: #fff; color: var(--color-ink); }
.badge { position: absolute; top: -6px; right: -6px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 99px;
  background: var(--color-danger); color: #fff; font-size: 0.65rem; font-weight: 700; line-height: 18px; text-align: center; }
.badge.pulse { animation: bell-pulse 0.9s ease-out 1; }
@keyframes bell-pulse { 0% { box-shadow: 0 0 0 0 rgba(180, 35, 24, 0.55); } 100% { box-shadow: 0 0 0 10px rgba(180, 35, 24, 0); } }

.panel { position: absolute; right: 0; top: calc(100% + 8px); z-index: 40; width: min(380px, calc(100vw - 24px)); max-height: 480px; overflow-y: auto;
  background: #fff; border: 1px solid var(--color-line); border-radius: 12px; box-shadow: 0 14px 36px rgba(14, 45, 38, 0.18); }
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 14px 8px; }
.panel-head h2 { font-size: 1rem; }
.link { padding: 4px 6px; border: 0; background: none; color: var(--color-brand-dark); font-size: 0.78rem; }
.tabs { display: flex; gap: 4px; padding: 0 10px 8px; border-bottom: 1px solid var(--color-line); }
.tabs button { padding: 5px 10px; border: 0; border-radius: 99px; background: none; font-size: 0.78rem; color: var(--color-muted); }
.tabs button.on { background: var(--color-brand-soft); color: var(--color-brand-dark); }
.tab-count { margin-left: 6px; padding: 0 6px; border-radius: 99px; background: var(--color-danger); color: #fff; font-size: 0.65rem; }
.empty { margin: 0; padding: 22px 16px; color: var(--color-muted); font-size: 0.85rem; text-align: center; }
ul { list-style: none; margin: 0; padding: 0; }
li { position: relative; display: flex; align-items: stretch; border-bottom: 1px solid var(--color-line); border-left: 4px solid var(--color-info); }
li:last-child { border-bottom: 0; }
li.unread { background: #f6faf9; }
li.lv-warning { border-left-color: #d49a2e; }
li.lv-critical { border-left-color: var(--color-danger); }
li.lv-critical.unread { background: var(--color-danger-soft); }
.main { display: flex; flex: 1; align-items: flex-start; gap: 10px; min-width: 0; padding: 12px 12px 12px 10px; border: 0; border-radius: 0; background: transparent; text-align: left; font-weight: 400; }
.main:hover:not(:disabled) { background: rgba(0, 0, 0, 0.03); }
.ico { display: grid; place-items: center; flex: none; margin-top: 1px; color: var(--color-info); }
.lv-warning .ico { color: var(--color-warning); }
.lv-critical .ico { color: var(--color-danger); }
.text { display: grid; gap: 2px; min-width: 0; font-size: 0.82rem; line-height: 1.4; }
.text strong { font-size: 0.85rem; }
.detail { color: var(--color-ink); overflow-wrap: anywhere; }
time { color: var(--color-muted); font-size: 0.72rem; }
.dot { flex: none; width: 8px; height: 8px; margin-top: 6px; border-radius: 50%; background: var(--color-brand); }
.item-actions { display: flex; flex-direction: column; justify-content: center; gap: 2px; padding-right: 6px; opacity: 0; transition: opacity 0.12s; }
li:hover .item-actions, li:focus-within .item-actions { opacity: 1; }
.item-actions button { display: grid; place-items: center; padding: 5px; border: 0; background: transparent; color: var(--color-muted); border-radius: 6px; }
.item-actions button:hover { background: rgba(0, 0, 0, 0.06); color: var(--color-ink); }
@media (hover: none) { .item-actions { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .badge.pulse { animation: none; } }
</style>
