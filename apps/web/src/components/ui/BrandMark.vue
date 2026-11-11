<script setup lang="ts">
import { BRAND } from '../../shared/brand';
</script>

<template>
  <span class="brand-mark" aria-hidden="true">{{ BRAND.initial }}</span>
</template>

<style scoped>
.brand-mark { width: 36px; height: 36px; display: grid; place-items: center; flex-shrink: 0; border-radius: 9px;
  background: #fff; color: var(--color-brand); font-family: var(--font-display); font-weight: 700; font-size: 1.2rem; }
</style>
