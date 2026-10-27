<script setup lang="ts">
defineProps<{ label: string; tone: 'neutral' | 'info' | 'success' | 'dark' | 'danger' | 'warning' }>();
</script>

<template><span class="chip" :class="`tone-${tone}`">{{ label }}</span></template>

<style scoped>
.chip { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 0.8rem; font-weight: 600; }
.tone-neutral { background: #e8ebf0; color: #4b5563; }
.tone-info { background: #dbe8fe; color: #1d4ed8; }
.tone-success { background: #dff4e5; color: #176b36; }
.tone-dark { background: #176b36; color: #fff; }
.tone-danger { background: #fde3e3; color: #9c2020; }
.tone-warning { background: #fff0c7; color: #7d5700; }
</style>