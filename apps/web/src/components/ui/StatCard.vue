<script setup lang="ts">
defineProps<{
  titulo: string;
  valor: string | number;
  detalle?: string;
}>();
</script>

<template>
  <div class="stat-card">
    <span class="stat-title">{{ titulo }}</span>
    <h3 class="stat-value">{{ valor }}</h3>
    <span class="stat-detail" v-if="detalle">{{ detalle }}</span>
  </div>
</template>