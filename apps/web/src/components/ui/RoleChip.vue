<script setup lang="ts">
import { computed } from 'vue';
import { ROLE_LABELS, type Role } from '../../features/iam/types';
import StatusChip, { type ChipTone } from './StatusChip.vue';

const props = defineProps<{ role: Role }>();

const TONES: Record<Role, ChipTone> = { MEDICO: 'info', ENFERMERO: 'success', ADMINISTRATIVO: 'violet' };
const label = computed(() => ROLE_LABELS[props.role]);
</script>

<template>
  <StatusChip :label="label" :tone="TONES[role]" />
</template>
