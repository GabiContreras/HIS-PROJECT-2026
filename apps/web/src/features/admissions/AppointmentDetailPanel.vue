<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppIcon from '../../components/ui/AppIcon.vue';
import SideDrawer from '../../components/ui/SideDrawer.vue';
import StatusChip from '../../components/ui/StatusChip.vue';
import { getPatient, type Patient } from '../../services/patients';
import type { TurnoAgenda } from '../../services/turnos';
import { formatDocument } from '../../shared/format';
import { doctorName, ESTADO_LABELS, ESTADO_TONES, isShortened, patientName } from './appointment-ui';
import { clinicDateOf, clinicEndTime, clinicTime, longDateLabel } from './clinic-hours';

const props = defineProps<{ open: boolean; turno: TurnoAgenda | null }>();
const emit = defineEmits<{ close: [] }>();

// Los datos de contacto no vienen con el turno: se piden aparte cuando hay paciente.
const patient = ref<Patient | null>(null);
const loading = ref(false);
const failed = ref(false);
let request = 0;

watch(
  () => [props.open, props.turno?.paciente?.id ?? null] as const,
  async ([isOpen, patientId]) => {
    const current = ++request;
    patient.value = null;
    failed.value = false;
    loading.value = false;
    if (!isOpen || !patientId) return;
    loading.value = true;
    try {
      const found = await getPatient(patientId);
      if (current === request) patient.value = found;
    } catch {
      if (current === request) failed.value = true;
    } finally {
      if (current === request) loading.value = false;
    }
  },
  { immediate: true },
);

const initials = computed(() => {
  const p = props.turno?.paciente;
  return p ? `${p.nombre.charAt(0)}${p.apellido.charAt(0)}`.toUpperCase() : '';
});
</script>

<template>
  <SideDrawer
    :open="open"
    title="Detalle del turno"
    :subtitle="turno ? longDateLabel(clinicDateOf(turno.fechaHora)) : undefined"
    @close="emit('close')"
  >
    <template #icon><AppIcon name="calendar" :size="22" /></template>

    <div v-if="turno" class="detail">
      <div class="chips">
        <StatusChip :label="ESTADO_LABELS[turno.estado]" :tone="ESTADO_TONES[turno.estado]" />
        <StatusChip v-if="turno.urgente" label="Entreturno" tone="warning" />
        <StatusChip v-else-if="isShortened(turno)" label="Duración reducida" tone="warning" />
      </div>

      <section class="block">
        <h3 class="label">Paciente</h3>
        <div v-if="turno.paciente" class="person">
          <span class="avatar">{{ initials }}</span>
          <span class="who">
            <strong>{{ patientName(turno) }}</strong>
            <small v-if="patient">
              DNI {{ formatDocument(patient.documento) }}<template v-if="patient.telefono"> · Tel. {{ patient.telefono }}</template>
            </small>
            <small v-else-if="loading">Cargando datos del paciente...</small>
            <small v-else-if="failed">No se pudieron cargar los datos de contacto.</small>
          </span>
        </div>
        <p v-else class="muted">Este turno no tiene paciente asignado.</p>
      </section>

      <section class="block">
        <h3 class="label">Médico</h3>
        <p class="value">{{ doctorName(turno) }}</p>
      </section>

      <section class="block grid-2col">
        <div>
          <h3 class="label">Horario</h3>
          <p class="value">{{ clinicTime(turno.fechaHora) }} a {{ clinicEndTime(turno.fechaHora, turno.duracionMinutos) }}</p>
        </div>
        <div>
          <h3 class="label">Duración</h3>
          <p class="value">{{ turno.duracionMinutos }} min</p>
        </div>
      </section>

      <p v-if="turno.urgente" class="note">
        Es un entreturno de 15 minutos insertado entre dos turnos regulares.
      </p>
      <p v-else-if="isShortened(turno)" class="note">
        Este turno se acortó a {{ turno.duracionMinutos }} minutos para dar lugar a un entreturno.
      </p>
    </div>

    <template #footer>
      <button type="button" class="btn btn-secondary close-btn" @click="emit('close')">Cerrar</button>
    </template>
  </SideDrawer>
</template>

<style scoped>
.detail { display: grid; gap: 20px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.block { display: grid; gap: 8px; padding-bottom: 18px; border-bottom: 1px solid var(--color-line); }
.block:last-of-type { border-bottom: 0; }
.label { font-family: var(--font); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-muted); }
.value { font-size: 1rem; font-weight: 600; }
.person { display: flex; align-items: center; gap: 12px; }
.avatar { display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; border-radius: 50%;
  background: #cfe7e1; color: var(--color-brand-dark); font-weight: 700; }
.who { display: grid; min-width: 0; }
.who strong { font-size: 1rem; }
.who small { color: var(--color-muted); font-size: 0.8rem; }
.grid-2col { grid-template-columns: 1fr 1fr; gap: 16px; }
.grid-2col > div { display: grid; gap: 8px; }
.note { padding: 12px 14px; border-radius: 10px; background: var(--color-warning-soft); color: var(--color-warning); font-size: 0.83rem; }
.close-btn { width: 100%; padding: 12px; }
</style>
