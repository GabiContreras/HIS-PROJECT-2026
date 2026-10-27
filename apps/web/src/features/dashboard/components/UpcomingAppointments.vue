<script setup lang="ts">
import { storeToRefs } from 'pinia';
import BaseCard from '@/components/ui/BaseCard.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useDashboardStore } from '@/stores/dashboard.store';
import { useSessionStore } from '@/features/iam/session.store';
import type { EstadoTurno } from '@/services/turnos';

const { upcomingAppointments, loading } = storeToRefs(useDashboardStore());
const session = useSessionStore();

const TONES: Record<EstadoTurno, 'neutral' | 'info' | 'success' | 'dark' | 'danger'> = {
  DISPONIBLE: 'neutral',
  RESERVADO: 'info',
  CONFIRMADO: 'success',
  ATENDIDO: 'dark',
  CANCELADO: 'danger',
};
const LABELS: Record<EstadoTurno, string> = {
  DISPONIBLE: 'Disponible',
  RESERVADO: 'Reservado',
  CONFIRMADO: 'Confirmado',
  ATENDIDO: 'Atendido',
  CANCELADO: 'Cancelado',
};

const canSeeAgenda = () => session.role === 'MEDICO' || session.role === 'ADMINISTRATIVO';
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
</script>

<template>
  <BaseCard>
    <template #header><h3>Próximos turnos</h3></template>

    <p v-if="!canSeeAgenda()" class="muted">Tu rol no tiene acceso a la agenda.</p>
    <p v-else-if="loading" role="status">Cargando turnos...</p>
    <p v-else-if="upcomingAppointments.length === 0" class="muted">No hay turnos para hoy.</p>
    <table v-else>
      <thead>
        <tr><th>Hora</th><th>Paciente</th><th>Médico</th><th>Estado</th></tr>
      </thead>
      <tbody>
        <tr v-for="t in upcomingAppointments" :key="t.id" class="row-hover">
          <td>{{ time(t.fechaHora) }}</td>
          <td>{{ t.paciente ? `${t.paciente.nombre} ${t.paciente.apellido}` : 'Sin asignar' }}</td>
          <td>{{ t.medico.nombre }} {{ t.medico.apellido }}</td>
          <td><StatusChip :label="LABELS[t.estado]" :tone="TONES[t.estado]" /></td>
        </tr>
      </tbody>
    </table>
  </BaseCard>
</template>

<style scoped>
h3 { margin: 0; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: var(--space-2); text-align: left; border-bottom: 1px solid var(--color-border); }
th { color: var(--color-muted); font-size: 0.8rem; font-weight: 600; }
.row-hover:hover { background: #f1f5f9; }
.muted { color: var(--color-muted); }
</style>