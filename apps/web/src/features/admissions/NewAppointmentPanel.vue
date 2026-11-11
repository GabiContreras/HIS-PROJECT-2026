<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import PatientSearch from '../../components/PatientSearch.vue';
import AppIcon from '../../components/ui/AppIcon.vue';
import NoticeBanner from '../../components/ui/NoticeBanner.vue';
import SideDrawer from '../../components/ui/SideDrawer.vue';
import DayPicker from './DayPicker.vue';
import type { Patient } from '../../services/patients';
import { agregarEspera, listarDisponibles, reservarEntreturno, reservarTurno, type SlotDisponible } from '../../services/turnos';
import { messageFrom } from '../../shared/errors';
import { clinicDateOf, clinicTime, dayRange, longDateLabel, todayInClinic } from './clinic-hours';

export interface DoctorOption {
  id: string;
  nombre: string;
  apellido: string;
}

const props = defineProps<{
  open: boolean;
  medicos: DoctorOption[];
  prefill: SlotDisponible | null;
  lockedMedicoId: string | null;
}>();

const emit = defineEmits<{
  close: [];
  reserved: [mensaje: string];
  changed: [];
}>();

const QUARTER_MS = 15 * 60_000;

const fecha = ref(todayInClinic());
const medicoId = ref('');
const paciente = ref<Patient | null>(null);
const selectedStart = ref<string | null>(null);
const esEntreturno = ref(false);
const slots = ref<SlotDisponible[]>([]);
const loadingSlots = ref(false);
const slotsError = ref<string | null>(null);
const reservando = ref(false);
const errorReserva = ref<string | null>(null);

let slotsRequest = 0;

const today = todayInClinic();
const medicoActual = computed(() => props.medicos.find((m) => m.id === medicoId.value) ?? null);

const opciones = computed<SlotDisponible[]>(() => {
  if (!esEntreturno.value) return slots.value;
  return slots.value
    .filter((s) => s.duracionMinutos === 30)
    .map((s) => ({
      ...s,
      fechaHora: new Date(new Date(s.fechaHora).getTime() + QUARTER_MS).toISOString(),
      duracionMinutos: 15,
    }));
});
const selected = computed(() => opciones.value.find((o) => o.fechaHora === selectedStart.value) ?? null);
const canSubmit = computed(() => !!paciente.value && !!selected.value && !reservando.value);

async function loadSlots(): Promise<void> {
  const current = ++slotsRequest;
  slotsError.value = null;
  if (!medicoId.value) {
    slots.value = [];
    return;
  }
  loadingSlots.value = true;
  try {
    const found = await listarDisponibles({ medicoId: medicoId.value, ...dayRange(fecha.value) });
    if (current !== slotsRequest) return;
    slots.value = [...found].sort((a, b) => a.fechaHora.localeCompare(b.fechaHora));
    if (selectedStart.value && !opciones.value.some((o) => o.fechaHora === selectedStart.value)) {
      selectedStart.value = null;
    }
  } catch (reason) {
    if (current === slotsRequest) slotsError.value = messageFrom(reason, 'No se pudieron cargar los horarios.');
  } finally {
    if (current === slotsRequest) loadingSlots.value = false;
  }
}

function reset(): void {
  paciente.value = null;
  errorReserva.value = null;
  reservando.value = false;
  esEntreturno.value = false;
  if (props.prefill) {
    fecha.value = clinicDateOf(props.prefill.fechaHora);
    medicoId.value = props.prefill.medico.id;
    selectedStart.value = props.prefill.fechaHora;
  } else {
    fecha.value = todayInClinic();
    medicoId.value = props.lockedMedicoId ?? props.medicos[0]?.id ?? '';
    selectedStart.value = null;
  }
  void loadSlots();
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) reset();
  },
);

watch(
  () => props.medicos,
  (list) => {
    const first = list[0];
    if (props.open && !medicoId.value && first) {
      medicoId.value = props.lockedMedicoId ?? first.id;
      void loadSlots();
    }
  },
);

function onChoiceChange(): void {
  selectedStart.value = null;
  errorReserva.value = null;
  void loadSlots();
}

function onUrgentToggle(): void {
  selectedStart.value = null;
  errorReserva.value = null;
}

function pickSlot(slot: SlotDisponible): void {
  selectedStart.value = slot.fechaHora;
  errorReserva.value = null;
}

async function anotarEnEspera(): Promise<void> {
  const patient = paciente.value;
  if (!patient || !medicoId.value || reservando.value) return;
  reservando.value = true;
  errorReserva.value = null;
  try {
    const entry = await agregarEspera({ medicoId: medicoId.value, pacienteId: patient.id, fecha: fecha.value });
    emit('changed');
    emit(
      'reserved',
      `${patient.nombre} ${patient.apellido} quedó en la lista de espera (lugar ${entry.posicion}). Si alguien cancela ese día, se le asigna el horario automáticamente.`,
    );
    emit('close');
  } catch (reason) {
    errorReserva.value = messageFrom(reason, 'No se pudo anotar en la lista de espera.');
    await loadSlots();
  } finally {
    reservando.value = false;
  }
}

async function submit(): Promise<void> {
  const slot = selected.value;
  const patient = paciente.value;
  if (!slot || !patient) return;
  const urgente = esEntreturno.value;
  const nombre = `${patient.nombre} ${patient.apellido}`;
  reservando.value = true;
  errorReserva.value = null;
  try {
    const datos = { medicoId: medicoId.value, fechaHora: slot.fechaHora, pacienteId: patient.id };
    await (urgente ? reservarEntreturno(datos) : reservarTurno(datos));
    emit('changed');
    emit(
      'reserved',
      urgente
        ? `Entreturno insertado para ${nombre}. El horario anterior quedó con duración reducida.`
        : `Turno reservado para ${nombre}. Estado: Programado.`,
    );
    emit('close');
  } catch (reason) {
    errorReserva.value = messageFrom(reason, 'No se pudo reservar el turno.');
    selectedStart.value = null;
    emit('changed');
    await loadSlots();
  } finally {
    reservando.value = false;
  }
}
</script>

<template>
  <SideDrawer :open="open" title="Nuevo turno" subtitle="Completá los datos de la reserva" @close="emit('close')">
    <template #icon><AppIcon name="calendar" :size="22" /></template>

    <form id="new-appointment-form" class="form" novalidate @submit.prevent="submit">
      <DayPicker v-model="fecha" :min="today" label="FECHA DEL TURNO" @change="onChoiceChange" />

      <section class="group">
        <h3 class="label">Paciente <span class="req">*</span></h3>
        <PatientSearch v-model="paciente" />
      </section>

      <section class="group">
        <label class="label" for="appointment-doctor">Médico <span class="req">*</span></label>
        <div class="select-wrap">
          <AppIcon name="stethoscope" :size="18" class="lead" />
          <select
            id="appointment-doctor"
            v-model="medicoId"
            :disabled="!!lockedMedicoId || medicos.length === 0"
            @change="onChoiceChange"
          >
            <option value="" disabled>Seleccioná un médico</option>
            <option v-for="m in medicos" :key="m.id" :value="m.id">{{ m.nombre }} {{ m.apellido }}</option>
          </select>
          <AppIcon name="chevron-down" :size="16" class="trail" />
        </div>
      </section>

      <label class="urgent-toggle">
        <input v-model="esEntreturno" type="checkbox" @change="onUrgentToggle" />
        <span class="text">
          <strong>Es un entreturno</strong>
          <small>Turno de 15 min a los :15 o :45, dentro de un horario libre. El horario de al lado queda reducido a 15 min.</small>
        </span>
      </label>

      <section class="group">
        <div class="slots-head">
          <h3 class="label">{{ esEntreturno ? 'Horario del entreturno' : 'Horario disponible' }} <span class="req">*</span></h3>
          <span class="duration">{{ selected?.duracionMinutos ?? (esEntreturno ? 15 : 30) }} min</span>
        </div>
        <p class="hint">Seleccioná un horario válido. La hora no se ingresa manualmente.</p>

        <NoticeBanner v-if="errorReserva" tone="error" title="No se pudo reservar el turno">
          {{ errorReserva }}
        </NoticeBanner>

        <NoticeBanner v-if="slotsError" tone="error">
          {{ slotsError }}
          <button type="button" class="btn-sm" @click="loadSlots">Reintentar</button>
        </NoticeBanner>
        <p v-else-if="!medicoId" class="hint empty">Elegí un médico para ver sus horarios.</p>
        <div v-else-if="loadingSlots && slots.length === 0" class="grid" aria-busy="true" role="status">
          <span v-for="n in 8" :key="n" class="skeleton"></span>
          <span class="sr-only">Cargando horarios...</span>
        </div>
        <p v-else-if="opciones.length === 0" class="empty">
          No hay horarios {{ esEntreturno ? 'con lugar para un entreturno' : 'disponibles' }} para
          <strong>{{ medicoActual ? `${medicoActual.nombre} ${medicoActual.apellido}` : 'este médico' }}</strong>
          el {{ longDateLabel(fecha).toLowerCase() }}. Probá con otro día.
          <template v-if="!esEntreturno">
            <br />
            <span class="wait-offer">
              ¿Querés anotar al paciente en la lista de espera? Si alguien cancela ese día, se le asigna el horario automáticamente.
            </span>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              :disabled="!paciente || reservando"
              @click="anotarEnEspera"
            >
              {{ paciente ? 'Anotar en lista de espera' : 'Elegí un paciente para anotarlo' }}
            </button>
          </template>
        </p>
        <div v-else class="grid" role="group" aria-label="Horarios disponibles">
          <button
            v-for="slot in opciones"
            :key="slot.fechaHora"
            type="button"
            class="time"
            :class="{ selected: slot.fechaHora === selectedStart, 'urgent-opt': esEntreturno }"
            :aria-pressed="slot.fechaHora === selectedStart"
            :title="esEntreturno ? 'Entreturno de 15 minutos' : slot.duracionMinutos < 30 ? 'Duración reducida: 15 minutos' : undefined"
            @click="pickSlot(slot)"
          >
            {{ clinicTime(slot.fechaHora) }}
            <AppIcon v-if="slot.fechaHora === selectedStart" name="check" :size="15" />
          </button>
        </div>
      </section>
    </form>

    <template #footer>
      <div class="actions-row">
        <button type="button" class="btn btn-secondary cancel" :disabled="reservando" @click="emit('close')">Cancelar</button>
        <button type="submit" form="new-appointment-form" class="btn submit" :disabled="!canSubmit">
          <AppIcon name="calendar" :size="18" />
          {{ reservando ? 'Reservando...' : 'Reservar turno' }}
        </button>
      </div>
      <p class="note">
        <AppIcon name="check" :size="13" />
        <template v-if="esEntreturno">Entreturno de <strong>15 min</strong>: el horario anterior quedará reducido a 15 min.</template>
        <template v-else>Al confirmar quedará <strong>Programado</strong> y bloqueado.</template>
      </p>
    </template>
  </SideDrawer>
</template>

<style scoped>
.form { display: grid; gap: 22px; }
.group { display: grid; gap: 8px; }
.label { display: block; font-family: var(--font); font-size: 0.88rem; font-weight: 700; letter-spacing: 0; }
.req { color: var(--color-danger); }

.select-wrap { position: relative; }
.select-wrap select { appearance: none; padding: 12px 40px 12px 42px; border-radius: 10px; font-weight: 500; }
.select-wrap .lead { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--color-muted); pointer-events: none; }
.select-wrap .trail { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: var(--color-muted); pointer-events: none; }

.slots-head { display: flex; align-items: center; justify-content: space-between; }
.duration { padding: 3px 10px; border-radius: 99px; background: #eef1f0; color: var(--color-muted); font-size: 0.72rem; font-weight: 700; }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.time { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 46px; padding: 0 6px;
  border: 1px solid var(--color-line); border-radius: 10px; background: #fff; font-weight: 600; font-variant-numeric: tabular-nums; }
.time:hover:not(:disabled) { border-color: var(--color-brand); background: var(--color-brand-soft); }
.time.selected, .time.selected:hover:not(:disabled) { background: var(--color-brand); border-color: var(--color-brand); color: #fff; }
.skeleton { height: 46px; border-radius: 10px; background: linear-gradient(90deg, #eef1f0, #f7f9f8, #eef1f0); }
.empty { padding: 14px; border: 1px dashed var(--color-line); border-radius: 10px; color: var(--color-muted); font-size: 0.85rem; }
.hint.empty { border: 0; padding: 4px 0; }

.wait-offer { display: block; margin: 8px 0; }
.urgent-toggle { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border: 1px solid var(--color-line); border-radius: 12px; background: #fff; cursor: pointer; }
.urgent-toggle:has(input:checked) { border-color: #d49a2e; background: #fdf6e7; }
.urgent-toggle input { width: 18px; height: 18px; margin-top: 2px; accent-color: #d49a2e; flex: none; }
.urgent-toggle .text { display: grid; gap: 2px; line-height: 1.35; }
.urgent-toggle strong { font-size: 0.88rem; }
.urgent-toggle small { color: var(--color-muted); font-size: 0.78rem; }
.time.urgent-opt { border-color: #e5c987; }
.time.urgent-opt.selected, .time.urgent-opt.selected:hover:not(:disabled) { background: #d49a2e; border-color: #d49a2e; }

.actions-row { display: flex; gap: 12px; }
.cancel { flex: 0 0 auto; padding: 12px 22px; }
.submit { flex: 1; padding: 12px 18px; }
.submit:disabled { background: var(--color-brand); border-color: var(--color-brand); }
.note { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 10px; color: var(--color-muted); font-size: 0.75rem; }
.note svg { color: var(--color-brand); }

@media (max-width: 520px) {
  .grid { grid-template-columns: repeat(3, 1fr); }
}
</style>
