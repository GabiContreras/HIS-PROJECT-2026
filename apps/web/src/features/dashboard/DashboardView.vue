<script setup lang="ts">
import { computed } from 'vue';
import { useSessionStore } from '../iam/session.store';
import AdminHome from './homes/AdminHome.vue';
import DoctorHome from './homes/DoctorHome.vue';
import NurseHome from './homes/NurseHome.vue';

const session = useSessionStore();

// Cada rol tiene su propio panel de inicio.
const home = computed(() => {
  if (session.role === 'MEDICO') return DoctorHome;
  if (session.role === 'ENFERMERO') return NurseHome;
  return AdminHome;
});
</script>

<template>
  <component :is="home" />
</template>
