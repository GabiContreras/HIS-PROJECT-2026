<script setup lang="ts">
defineProps<{ tone: 'success' | 'error' | 'warning' | 'info'; title?: string }>();
</script>

<template>
  <div class="notice" :class="`notice-${tone}`" :role="tone === 'error' || tone === 'warning' ? 'alert' : 'status'">
    <div>
      <strong v-if="title">{{ title }}</strong>
      <slot />
    </div>
  </div>
</template>
