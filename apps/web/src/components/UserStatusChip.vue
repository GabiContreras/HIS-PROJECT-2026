<script setup lang="ts">
import { computed } from 'vue';
import StatusChip from './ui/StatusChip.vue';
import type { AccountStatus } from '../features/iam/types';

const props = defineProps<{ status: AccountStatus }>();

const LABELS: Record<AccountStatus, string> = {
  PENDIENTE_VERIFICACION: 'Pendiente de verificación',
  PENDIENTE_HABILITACION: 'Pendiente de habilitación',
  ACTIVO: 'Activo',
  DESHABILITADO: 'Deshabilitado',
};
const TONES: Record<AccountStatus, 'success' | 'danger' | 'warning'> = {
  PENDIENTE_VERIFICACION: 'warning',
  PENDIENTE_HABILITACION: 'warning',
  ACTIVO: 'success',
  DESHABILITADO: 'danger',
};

const label = computed(() => LABELS[props.status]);
const tone = computed(() => TONES[props.status]);
</script>

<template>
  <StatusChip :label="label" :tone="tone" />
</template>