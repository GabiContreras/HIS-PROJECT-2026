<script setup lang="ts">
import { computed } from 'vue';
import type { AccountStatus } from '../features/iam/types';
import StatusChip, { type ChipTone } from './ui/StatusChip.vue';

const props = defineProps<{ status: AccountStatus }>();

const LABELS: Record<AccountStatus, string> = {
  PENDIENTE_VERIFICACION: 'Pendiente de verificación',
  PENDIENTE_HABILITACION: 'Pendiente de habilitación',
  ACTIVO: 'Activo',
  DESHABILITADO: 'Deshabilitado',
};
const TONES: Record<AccountStatus, ChipTone> = {
  PENDIENTE_VERIFICACION: 'warning',
  PENDIENTE_HABILITACION: 'warning',
  ACTIVO: 'success',
  DESHABILITADO: 'danger',
};

const label = computed(() => LABELS[props.status]);
</script>

<template>
  <StatusChip :label="label" :tone="TONES[status]" />
</template>
