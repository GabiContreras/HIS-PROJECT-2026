<script setup lang="ts">
// dsp agregar props obligatorias,vienen de los endpoints, para que el componente sea reutilizable
</script>

<template>
  <div class="base-card">
    <div class="card-header" v-if="$slots.header">
      <slot name="header" />
    </div>
    <div class="card-body">
      <slot />
    </div>
  </div>
</template>