<script setup lang="ts">
import { useNotificationStore } from '../../stores/notification.store';
import ToastItem from './ToastItem.vue';

const store = useNotificationStore();
</script>

<template>
  <!-- Arriba a la derecha: abajo taparía los botones del pie de los drawers. -->
  <Teleport to="body">
    <TransitionGroup tag="div" name="toast" class="toast-host" aria-label="Avisos">
      <ToastItem v-for="t in store.toasts" :key="t.id" :toast="t" />
    </TransitionGroup>
  </Teleport>
</template>

<style>
.toast-host { position: fixed; top: 84px; right: 20px; z-index: 1100; display: grid; gap: 8px; width: min(380px, calc(100vw - 32px));
  pointer-events: none; }
.toast-enter-active { transition: opacity 0.18s ease-out, transform 0.18s ease-out; }
.toast-leave-active { position: absolute; left: 0; right: 0; transition: opacity 0.15s ease-in, transform 0.15s ease-in; }
.toast-move { transition: transform 0.2s ease; }
.toast-enter-from { opacity: 0; transform: translateX(8px); }
.toast-leave-to { opacity: 0; transform: translateX(8px); }
@media (max-width: 640px) {
  .toast-host { top: 72px; right: 16px; left: 16px; width: auto; }
}
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active, .toast-leave-active, .toast-move { transition: opacity 0.15s; }
  .toast-enter-from, .toast-leave-to { transform: none; }
}
</style>
