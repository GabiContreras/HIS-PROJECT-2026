<template>
  <section class="card">
    <header v-if="$slots.header || $slots.action" class="card-head">
      <slot name="header" />
      <div v-if="$slots.action" class="card-action"><slot name="action" /></div>
    </header>
    <div class="card-body"><slot /></div>
  </section>
</template>

<style scoped>
.card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius);
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04); }
.card-head { display: flex; justify-content: space-between; align-items: center; gap: var(--space-2);
  padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border); }
.card-action { font-size: 0.85rem; white-space: nowrap; }
.card-body { padding: var(--space-3) var(--space-4); }
</style>