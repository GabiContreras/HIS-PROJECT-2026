<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>();
</script>

<template>
  <header class="page-header">
    <div>
      <h1>{{ title }}</h1>
      <p v-if="subtitle" class="muted">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.default" class="extra"><slot /></div>
  </header>
</template>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; }
.page-header h1 { color: var(--color-brand-dark); }
.page-header p { font-size: 0.88rem; margin-top: 2px; }
.extra { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
</style>
