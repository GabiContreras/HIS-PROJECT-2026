<script setup lang="ts">
withDefaults(
  defineProps<{
    titulo: string;
    valor: string | number;
    detalle?: string;
    icon?: string;
    tone?: 'info' | 'accent' | 'warning' | 'violet';
    progress?: number;
  }>(),
  { tone: 'info' },
);
</script>

<template>
  <article class="stat">
    <span v-if="icon" class="icon" :class="`tone-${tone}`" aria-hidden="true">{{ icon }}</span>
    <div class="body">
      <p class="title">{{ titulo }}</p>
      <p class="value">{{ valor }}</p>
      <div v-if="progress !== undefined" class="bar" role="progressbar" :aria-valuenow="progress">
        <span :style="{ width: `${progress}%` }"></span>
      </div>
      <p v-if="detalle" class="detail">{{ detalle }}</p>
    </div>
  </article>
</template>

<style scoped>
.stat { display: flex; gap: var(--space-3); padding: var(--space-3) var(--space-4); background: var(--color-surface);
  border: 1px solid var(--color-border); border-radius: var(--radius); box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04); }
.icon { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; font-size: 1.3rem; flex-shrink: 0; }
.tone-info { background: #e6eefb; } .tone-accent { background: #e3f5f2; }
.tone-warning { background: #fdebd9; } .tone-violet { background: #efe9fb; }
.body { min-width: 0; flex: 1; }
p { margin: 0; }
.title { color: var(--color-muted); font-size: 0.85rem; }
.value { font-size: 1.6rem; font-weight: 700; color: var(--color-text); }
.detail { color: var(--color-muted); font-size: 0.8rem; margin-top: 2px; }
.bar { height: 6px; background: #e8ebf0; border-radius: 999px; margin: 6px 0 2px; overflow: hidden; }
.bar span { display: block; height: 100%; background: var(--color-accent); border-radius: 999px; }
</style>