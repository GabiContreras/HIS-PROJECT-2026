<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Toast, ToastSeverity } from '../../features/feedback/types';
import { useNotificationStore } from '../../stores/notification.store';
import AppIcon, { type IconName } from '../ui/AppIcon.vue';

const props = defineProps<{ toast: Toast }>();
const store = useNotificationStore();

const ICONS: Record<ToastSeverity, IconName> = {
  success: 'check',
  info: 'info',
  warning: 'triangle-alert',
  error: 'alert',
};

const hovered = ref(false);
const focused = ref(false);
const tabHidden = ref(document.visibilityState === 'hidden');
const paused = computed(() => hovered.value || focused.value || tabHidden.value);

const remaining = ref(props.toast.duration ?? 0);
const barCycle = ref(0);
let timer: ReturnType<typeof setTimeout> | undefined;
let startedAt = 0;

function stop(): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
}

function start(): void {
  if (props.toast.duration === null || paused.value) return;
  stop();
  startedAt = Date.now();
  timer = setTimeout(close, Math.max(remaining.value, 0));
}

function pause(): void {
  if (timer === undefined) return;
  stop();
  remaining.value -= Date.now() - startedAt;
}

function close(): void {
  stop();
  store.dismissToast(props.toast.id);
}

function runAction(): void {
  props.toast.action?.handler();
  close();
}

const onVisibility = (): void => {
  tabHidden.value = document.visibilityState === 'hidden';
};

watch(paused, (isPaused) => (isPaused ? pause() : start()));
watch(
  () => props.toast.touchedAt,
  () => {
    remaining.value = props.toast.duration ?? 0;
    barCycle.value += 1;
    stop();
    start();
  },
);

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility);
  start();
});
onBeforeUnmount(() => {
  stop();
  document.removeEventListener('visibilitychange', onVisibility);
});

const live = computed(() => (props.toast.severity === 'error' || props.toast.severity === 'warning' ? 'alert' : 'status'));
</script>

<template>
  <article
    class="toast"
    :class="`toast-${toast.severity}`"
    :role="live"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @focusin="focused = true"
    @focusout="focused = false"
    @keydown.esc.stop="close"
  >
    <span class="icon" aria-hidden="true"><AppIcon :name="ICONS[toast.severity]" :size="20" /></span>
    <div class="body">
      <strong v-if="toast.title">{{ toast.title }}</strong>
      <span class="message">{{ toast.message }}</span>
      <button v-if="toast.action" class="action" type="button" @click="runAction">{{ toast.action.label }}</button>
    </div>
    <span v-if="toast.count > 1" class="count" :aria-label="`${toast.count} veces`">×{{ toast.count }}</span>
    <button class="close" type="button" aria-label="Cerrar aviso" @click="close"><AppIcon name="x" :size="16" /></button>
    <span
      v-if="toast.duration !== null"
      :key="barCycle"
      class="bar"
      :style="{ animationDuration: `${toast.duration}ms`, animationPlayState: paused ? 'paused' : 'running' }"
    ></span>
  </article>
</template>

<style scoped>
.toast { position: relative; display: flex; align-items: flex-start; gap: 12px; overflow: hidden; padding: 12px 12px 14px 14px;
  border: 1px solid; border-radius: 12px; background: #fff; box-shadow: 0 10px 28px rgba(14, 45, 38, 0.16); font-size: 0.85rem; pointer-events: auto; }
.icon { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; flex: none; }
.body { display: grid; gap: 2px; flex: 1; min-width: 0; line-height: 1.4; }
.body strong { font-size: 0.9rem; font-weight: 600; }
.message { overflow-wrap: anywhere; color: var(--color-ink); }
.action { justify-self: start; margin-top: 6px; padding: 5px 10px; font-size: 0.78rem; border-radius: 6px; }
.count { align-self: center; padding: 1px 7px; border-radius: 99px; background: rgba(0, 0, 0, 0.08); font-size: 0.7rem; font-weight: 700; }
.close { display: grid; place-items: center; padding: 4px; border: 0; background: transparent; color: var(--color-muted); border-radius: 6px; flex: none; }
.close:hover:not(:disabled) { background: rgba(0, 0, 0, 0.06); }
.bar { position: absolute; left: 0; bottom: 0; height: 3px; width: 100%; transform-origin: left; background: currentColor; opacity: 0.35;
  animation-name: toast-shrink; animation-timing-function: linear; animation-fill-mode: forwards; }
@keyframes toast-shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }

.toast-success { color: var(--color-brand-dark); background: var(--color-brand-soft); border-color: #b7d9d1; }
.toast-success .icon { background: #fff; color: var(--color-brand); }
.toast-info { color: var(--color-info); background: var(--color-info-soft); border-color: #c8e1e8; }
.toast-info .icon { background: #fff; }
.toast-warning { color: var(--color-warning); background: var(--color-warning-soft); border-color: #ead6a4; }
.toast-warning .icon { background: #fff; }
.toast-error { color: var(--color-danger); background: var(--color-danger-soft); border-color: #f1c6c0; }
.toast-error .icon { background: #fff; }
.toast .body strong { color: inherit; }
</style>
