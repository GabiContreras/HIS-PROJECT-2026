<script lang="ts">
import { reactive } from 'vue';

// Pila de paneles abiertos. Sirve para que un panel se abra encima de otro: solo el de arriba
// reacciona a Esc y el scroll de la página recién se libera cuando se cierra el último.
const openStack = reactive<number[]>([]);
let lastId = 0;
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ open: boolean; title: string; subtitle?: string }>();
const emit = defineEmits<{ close: [] }>();

const id = ++lastId;
const titleId = `drawer-title-${id}`;
const panel = ref<HTMLElement | null>(null);
let previouslyFocused: HTMLElement | null = null;

// Cada panel abierto queda un escalón por encima del anterior.
const layer = computed(() => 40 + Math.max(openStack.indexOf(id), 0) * 2);

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && openStack[openStack.length - 1] === id) emit('close');
}

function release(): void {
  const index = openStack.indexOf(id);
  if (index !== -1) openStack.splice(index, 1);
  window.removeEventListener('keydown', onKeydown);
  if (openStack.length === 0) document.body.style.overflow = '';
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      previouslyFocused = document.activeElement as HTMLElement | null;
      openStack.push(id);
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', onKeydown);
      await nextTick();
      panel.value?.focus();
    } else {
      release();
      previouslyFocused?.focus?.();
      previouslyFocused = null;
    }
  },
);

onBeforeUnmount(release);
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="open" class="drawer-root" :style="{ zIndex: layer }">
        <div class="overlay" @click="emit('close')"></div>
        <aside ref="panel" class="drawer" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1">
          <header class="head">
            <span class="icon-box"><slot name="icon" /></span>
            <div class="titles">
              <h2 :id="titleId">{{ title }}</h2>
              <p v-if="subtitle" class="muted">{{ subtitle }}</p>
            </div>
            <button class="close" type="button" aria-label="Cerrar panel" @click="emit('close')">
              <AppIcon name="x" :size="18" />
            </button>
          </header>
          <div class="body"><slot /></div>
          <footer v-if="$slots.footer" class="foot"><slot name="footer" /></footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-root { position: fixed; inset: 0; }
.overlay { position: absolute; inset: 0; background: rgba(14, 45, 38, 0.38); }
.drawer { position: absolute; top: 0; right: 0; bottom: 0; width: min(480px, 100vw); display: flex; flex-direction: column;
  background: #fff; box-shadow: -12px 0 40px rgba(14, 45, 38, 0.18); outline: none; }
.head { display: flex; align-items: center; gap: 14px; padding: 20px 24px; border-bottom: 1px solid var(--color-line); }
.icon-box { display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; border-radius: 12px;
  background: var(--color-brand-soft); color: var(--color-brand); }
.titles { flex: 1; min-width: 0; }
.titles h2 { font-size: 1.25rem; font-weight: 600; }
.titles p { font-size: 0.85rem; }
.close { display: grid; place-items: center; width: 40px; height: 40px; padding: 0; border: 0; border-radius: 10px;
  background: var(--color-bg); color: var(--color-ink); }
.body { flex: 1; overflow-y: auto; padding: 20px 24px; }
.foot { padding: 16px 24px 18px; border-top: 1px solid var(--color-line); background: #fff; }

.drawer-enter-active, .drawer-leave-active { transition: opacity 0.2s; }
.drawer-enter-active .drawer, .drawer-leave-active .drawer { transition: transform 0.22s ease; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
.drawer-enter-from .drawer, .drawer-leave-to .drawer { transform: translateX(100%); }
@media (prefers-reduced-motion: reduce) {
  .drawer-enter-active, .drawer-leave-active, .drawer-enter-active .drawer, .drawer-leave-active .drawer { transition: none; }
}
</style>
