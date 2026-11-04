<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { RouterLink } from 'vue-router';
import TriageList from '../../../components/TriageList.vue';
import VitalsList from '../../../components/VitalsList.vue';
import BaseCard from '../../../components/ui/BaseCard.vue';
import NoticeBanner from '../../../components/ui/NoticeBanner.vue';
import PageHeader from '../../../components/ui/PageHeader.vue';
import StatCard from '../../../components/ui/StatCard.vue';
import StatusChip from '../../../components/ui/StatusChip.vue';
import { formatTime, greeting, isToday, longDate } from '../../../shared/format';
import { useTriageStore } from '../../../stores/triage.store';
import { useVitalsStore } from '../../../stores/vitals.store';
import { ESTADO_LABELS, ESTADO_TONES, isShortened, patientName } from '../../admissions/appointment-ui';
import { useAppointments } from '../../admissions/useAppointments';
import { useSessionStore } from '../../iam/session.store';

const session = useSessionStore();
const agenda = useAppointments();
const triage = useTriageStore();
const vitals = useVitalsStore();
const { queue, redCount } = storeToRefs(triage);
const { critical } = storeToRefs(vitals);

// El back ya devuelve solo la agenda del médico que inició sesión.
const mine = computed(() =>
  agenda.turnos.value.filter((t) => isToday(t.fechaHora)).sort((a, b) => a.fechaHora.localeCompare(b.fechaHora)),
);
const active = computed(() => mine.value.filter((t) => t.estado === 'RESERVADO' || t.estado === 'CONFIRMADO'));
const next = computed(() => active.value.find((t) => new Date(t.fechaHora).getTime() >= Date.now()) ?? active.value[0]);

onMounted(() => Promise.all([agenda.cargar(), triage.load(), vitals.load()]));
</script>

<template>
  <div class="page">
    <PageHeader :title="greeting(`Dr/a. ${session.account?.apellido ?? ''}`.trim())" :subtitle="`Tu jornada, ${longDate()}.`">
      <RouterLink class="btn" :to="{ name: 'appointments' }">Mi agenda</RouterLink>
    </PageHeader>

    <NoticeBanner v-if="redCount > 0" tone="error" title="Código Rojo en guardia">
      Hay {{ redCount }} paciente{{ redCount === 1 ? '' : 's' }} con riesgo vital esperando atención.
      <RouterLink :to="{ name: 'triage' }">Ver cola de triaje</RouterLink>
    </NoticeBanner>
    <NoticeBanner v-if="agenda.error.value" tone="error">
      No se pudo cargar tu agenda: {{ agenda.error.value }}
      <button type="button" class="btn-sm" @click="agenda.cargar">Reintentar</button>
    </NoticeBanner>

    <div class="stats">
      <StatCard titulo="Mis turnos de hoy" :valor="mine.length" :detalle="`${active.length} por atender`" tone="info" />
      <StatCard
        titulo="Próximo turno"
        :valor="next ? formatTime(next.fechaHora) : '—'"
        :detalle="next ? patientName(next) : 'Sin turnos pendientes'"
        tone="brand"
      />
      <StatCard titulo="En cola de triaje" :valor="queue.length" :detalle="`${redCount} con riesgo vital`" tone="warning" />
      <StatCard titulo="Alertas críticas" :valor="critical.length" detalle="Signos vitales fuera de rango" tone="danger" />
    </div>

    <div class="grid-2">
      <BaseCard>
        <template #header><h3>Mi agenda de hoy</h3></template>
        <template #action><RouterLink :to="{ name: 'appointments' }">Ver agenda completa →</RouterLink></template>
        <p v-if="agenda.cargando.value" role="status">Cargando agenda...</p>
        <p v-else-if="mine.length === 0" class="muted">No tenés turnos para hoy.</p>
        <div v-else class="scroll-x">
          <table>
            <thead><tr><th>Hora</th><th>Paciente</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              <tr v-for="t in mine" :key="t.id">
                <td><strong>{{ formatTime(t.fechaHora) }}</strong> <small class="muted">{{ t.duracionMinutos }} min</small></td>
                <td>{{ patientName(t) }}</td>
                <td><StatusChip :label="ESTADO_LABELS[t.estado]" :tone="ESTADO_TONES[t.estado]" /></td>
                <td>
                  <StatusChip v-if="t.urgente" label="Entreturno" tone="warning" />
                  <StatusChip v-else-if="isShortened(t)" label="Tiempo reducido" tone="warning" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </BaseCard>

      <BaseCard>
        <template #header><h3>Cola de triaje</h3></template>
        <template #action><RouterLink :to="{ name: 'triage' }">Ver cola →</RouterLink></template>
        <TriageList :entries="queue" :limit="5" />
      </BaseCard>
    </div>

    <BaseCard>
      <template #header><h3>Alertas de signos vitales</h3></template>
      <template #action><RouterLink :to="{ name: 'vital-signs' }">Ver registros →</RouterLink></template>
      <VitalsList :records="critical" empty="No hay alertas críticas." />
    </BaseCard>
  </div>
</template>
