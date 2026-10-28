<script setup lang="ts">
withDefaults(
  defineProps<{
    titulo: string;
    valor: string | number;
    detalle?: string;
    tone?: 'brand' | 'info' | 'warning' | 'violet' | 'danger';
  }>(),
  { tone: 'brand' },
);
</script>

<template>
  <article class="stat" :class="`tone-${tone}`">
    <p class="label">{{ titulo }}</p>
    <p class="value">{{ valor }}</p>
    <p v-if="detalle" class="detail">{{ detalle }}</p>
  </article>
</template>

<style scoped>
.stat { display: grid; gap: 3px; padding: 16px 18px; background: #fff; border: 1px solid var(--color-line);
  border-left: 4px solid var(--stat-color); border-radius: 9px; }
.tone-brand { --stat-color: var(--color-brand); }
.tone-info { --stat-color: var(--color-info); }
.tone-warning { --stat-color: #d49a2e; }
.tone-violet { --stat-color: var(--color-violet); }
.tone-danger { --stat-color: var(--color-danger); }
.label { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-muted); }
.value { font-family: var(--font-display); font-size: 1.7rem; font-weight: 700; line-height: 1.2; }
.detail { font-size: 0.75rem; color: var(--color-muted); }
</style>
