<script setup lang="ts">
defineProps<{ 
  label: string; 
  tone: 'neutral' | 'info' | 'success' | 'dark' | 'danger' | 'warning';
}>();
</script>

<template>
  <span class="chip" :class="`tone-${tone}`">{{ label }}</span>
</template>