<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { messageFrom } from '../../shared/errors';
import { useNotificationStore } from '../../stores/notification.store';
import AppIcon, { type IconName } from '../ui/AppIcon.vue';

const store = useNotificationStore();
const request = computed(() => store.currentConfirm);
const tone = computed(() => request.value?.tone ?? 'info');
const ICONS: Record<string, IconName> = { danger: 'alert', warning: 'triangle-alert', info: 'info' };

const busy = ref(false);
const error = ref<string | null>(null);
const dialog = ref<HTMLElement | null>(null);
let previousFocus: HTMLElement | null = null;

async function focusSafeAction(): Promise<void> {
  await nextTick();
  // En acciones destructivas el foco arranca en la salida segura (cancelar), no en el botón peligroso.
  const buttons = dialog.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
  (buttons?.[0] ?? null)?.focus();
}

watch(request, (current, before) => {
  busy.value = false;
  error.value = null;
  if (current && !before) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
  }
  if (!current) {
    document.body.style.overflow = '';
    previousFocus?.focus();
    previousFocus = null;
  }
  if (current) void focusSafeAction();
});

function cancel(): void {
  if (busy.value || request.value?.blocking) return;
  store.settleConfirm(false);
}

async function accept(): Promise<void> {
  const current = request.value;
  if (!current || busy.value) return;
  if (!current.run) {
    store.settleConfirm(true);
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    await current.run();
    store.settleConfirm(true);
  } catch (reason) {
    // El modal no se cierra: el error se ve adentro y se puede reintentar o cancelar.
    error.value = messageFrom(reason, 'No se pudo completar la acción.');
    busy.value = false;
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (!request.value) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    cancel();
    return;
  }
  if (event.key !== 'Tab') return;
  // Trampa de foco: Tab no sale del modal.
  const focusable = [...(dialog.value?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])];
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div v-if="request" :key="request.id" class="confirm-backdrop" @mousedown.self="cancel">
        <section
          ref="dialog"
          class="confirm"
          :class="`tone-${tone}`"
          :role="tone === 'info' ? 'dialog' : 'alertdialog'"
          aria-modal="true"
          :aria-labelledby="`confirm-title-${request.id}`"
          :aria-describedby="`confirm-text-${request.id}`"
        >
          <span class="icon" aria-hidden="true"><AppIcon :name="ICONS[tone] ?? 'info'" :size="24" /></span>
          <h2 :id="`confirm-title-${request.id}`">{{ request.title }}</h2>
          <p :id="`confirm-text-${request.id}`" class="text">{{ request.message }}</p>
          <ul v-if="request.consequences?.length" class="consequences">
            <li v-for="c in request.consequences" :key="c">{{ c }}</li>
          </ul>
          <p v-if="error" class="error" role="alert">{{ error }}</p>
          <div class="actions">
            <button v-if="!request.blocking" class="btn btn-secondary" type="button" :disabled="busy" @click="cancel">
              {{ request.cancelLabel ?? 'Cancelar' }}
            </button>
            <button class="btn" :class="{ 'btn-danger': tone === 'danger' }" type="button" :disabled="busy" @click="accept">
              {{ busy ? 'Procesando...' : request.confirmLabel }}
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.confirm-backdrop { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 16px; background: rgba(14, 33, 28, 0.5); }
.confirm { width: min(440px, 100%); display: grid; gap: 10px; padding: 24px; border-radius: 16px; background: #fff;
  box-shadow: 0 24px 60px rgba(14, 45, 38, 0.3); }
.confirm .icon { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; }
.confirm.tone-danger .icon { background: var(--color-danger-soft); color: var(--color-danger); }
.confirm.tone-warning .icon { background: var(--color-warning-soft); color: var(--color-warning); }
.confirm.tone-info .icon { background: var(--color-info-soft); color: var(--color-info); }
.confirm h2 { font-family: var(--font-display); font-size: 1.15rem; }
.confirm .text { margin: 0; color: var(--color-muted); font-size: 0.9rem; line-height: 1.5; }
.confirm .consequences { margin: 0; padding: 12px 14px 12px 30px; border-radius: 10px; background: var(--color-bg); font-size: 0.85rem; line-height: 1.5; }
.confirm .error { margin: 0; color: var(--color-danger); font-size: 0.85rem; }
.confirm .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
.confirm-enter-active { transition: opacity 0.15s ease-out; }
.confirm-enter-active .confirm { transition: transform 0.18s ease-out, opacity 0.18s ease-out; }
.confirm-leave-active { transition: opacity 0.12s ease-in; }
.confirm-enter-from, .confirm-leave-to { opacity: 0; }
.confirm-enter-from .confirm { opacity: 0; transform: scale(0.98); }
@media (prefers-reduced-motion: reduce) {
  .confirm-enter-active .confirm { transition: none; }
}
</style>
