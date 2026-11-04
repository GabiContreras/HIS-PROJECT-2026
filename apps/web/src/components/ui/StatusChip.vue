<script setup lang="ts">
export type ChipTone = 'neutral' | 'info' | 'success' | 'dark' | 'danger' | 'warning' | 'violet';
defineProps<{ label: string; tone?: ChipTone }>();
</script>

<template>
  <span class="badge" :class="tone && tone !== 'neutral' ? `badge-${tone}` : ''">{{ label }}</span>
</template>
