<script setup lang="ts">
import type { AccountStatus } from '../features/iam/types';

defineProps<{ status: AccountStatus }>();

const labels: Record<AccountStatus, string> = {
  PENDIENTE_VERIFICACION: 'Pendiente de verificación',
  PENDIENTE_HABILITACION: 'Pendiente de habilitación',
  ACTIVO: 'Activo',
  DESHABILITADO: 'Deshabilitado',
};
</script>

<template>
  <span class="chip" :class="`status-${status.toLowerCase()}`">{{ labels[status] }}</span>
</template>

<style scoped>
.chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.8rem; }
.status-activo { background: #dff4e5; color: #176b36; }
.status-deshabilitado { background: #fde3e3; color: #9c2020; }
.status-pendiente_verificacion, .status-pendiente_habilitacion { background: #fff0c7; color: #7d5700; }
</style>
