<script setup lang="ts">
defineProps<{
  role: 'Médico' | 'Enfermero' | 'Administrativo';
}>();
</script>

<template>
  <span class="role-chip" :class="role.toLowerCase()">
    {{ role }}
  </span>
</template>