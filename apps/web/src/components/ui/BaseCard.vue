<template>
  <section class="card">
    <header v-if="$slots.header || $slots.action" class="card-head">
      <div class="title"><slot name="header" /></div>
      <div v-if="$slots.action" class="action"><slot name="action" /></div>
    </header>
    <div class="card-body"><slot /></div>
  </section>
</template>

<style scoped>
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--color-line); }
.title :deep(h2), .title :deep(h3), .title :deep(h4) { font-size: 1.02rem; }
.action { font-size: 0.82rem; white-space: nowrap; }
</style>
