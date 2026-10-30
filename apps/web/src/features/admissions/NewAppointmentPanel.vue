<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import PatientSearch from '../../components/PatientSearch.vue';
import AppIcon from '../../components/ui/AppIcon.vue';
import NoticeBanner from '../../components/ui/NoticeBanner.vue';
import SideDrawer from '../../components/ui/SideDrawer.vue';
import DayPicker from './DayPicker.vue';
import type { Patient } from '../../services/patients';
import { listarDisponibles, reservarTurno, type Turno, type TurnoAgenda } from '../../services/turnos';
import { messageFrom } from '../../shared/errors';
import { clinicDateOf, clinicTime, dayRange, isWithinClinicHours, longDateLabel, todayInClinic } from './clinic-hours';

export interface DoctorOption {
  id: string;
  nombre: string;
  apellido: string;
}

const props = defineProps<{
  open: boolean;
  medicos: DoctorOption[];
  /** Turno elegido desde la tabla: abre el panel con fecha, médico y horario ya cargados. */
  prefill: TurnoAgenda | null;
  /** Si la persona es médico, solo puede sacar turnos en su propia agenda. */
  lockedMedicoId: string | null;
}>();

const emit = defineEmits<{
  close: [];
  /** La reserva salió bien. */
  reserved: [patientName: string];
  /** Cambió la agenda (salió bien o hubo un conflicto): la pantalla de fondo tiene que refrescarse. */
  changed: [];
}>();

const fecha = ref(todayInClinic());
const medicoId = ref('');
const paciente = ref<Patient | null>(null);
const selectedId = ref<string | null>(null);
const slots = ref<Turno[]>([]);
const loadingSlots = ref(false);
const slotsError = ref<string | null>(null);
const reservando = ref(false);
const errorReserva = ref<string | null>(null);

let slotsRequest = 0;

const today = todayInClinic();
const medicoActual = computed(() => props.medicos.find((m) => m.id === medicoId.value) ?? null);
const selectedSlot = computed(() => slots.value.find((s) => s.id === selectedId.value) ?? null);
const canSubmit = computed(() => !!paciente.value && !!selectedSlot.value && !reservando.value);

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
    const prefillId = props.prefill?.id;
    // Solo turnos regulares dentro del horario de atención. Los entreturnos (15 min) se agregan en otro paso,
    // salvo el que la persona eligió a propósito desde la tabla.
    slots.value = found
      .filter((s) => s.id === prefillId || (!s.urgente && isWithinClinicHours(s.fechaHora, s.duracionMinutos)))
      .sort((a, b) => a.fechaHora.localeCompare(b.fechaHora));
    if (selectedId.value && !slots.value.some((s) => s.id === selectedId.value)) selectedId.value = null;
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
  if (props.prefill) {
    fecha.value = clinicDateOf(props.prefill.fechaHora);
    medicoId.value = props.prefill.medico.id;
    selectedId.value = props.prefill.id;
  } else {
    fecha.value = todayInClinic();
    medicoId.value = props.lockedMedicoId ?? props.medicos[0]?.id ?? '';
    selectedId.value = null;
  }
  void loadSlots();
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) reset();
  },
);

// La lista de médicos puede terminar de cargar con el panel ya abierto.
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

function onDateChange(): void {
  selectedId.value = null;
  errorReserva.value = null;
  void loadSlots();
}

function onDoctorChange(): void {
  selectedId.value = null;
  errorReserva.value = null;
  void loadSlots();
}

function pickSlot(slot: Turno): void {
  selectedId.value = slot.id;
  errorReserva.value = null;
}

async function submit(): Promise<void> {
  const slot = selectedSlot.value;
  const patient = paciente.value;
  if (!slot || !patient) return;
  reservando.value = true;
  errorReserva.value = null;
  try {
    await reservarTurno(slot.id, patient.id);
    emit('changed');
    emit('reserved', `${patient.nombre} ${patient.apellido}`);
    emit('close');
  } catch (reason) {
    // Por ejemplo, otra recepcionista tomó el mismo horario: se avisa y se recarga la grilla.
    errorReserva.value = messageFrom(reason, 'No se pudo reservar el turno.');
    selectedId.value = null;
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
      <DayPicker v-model="fecha" :min="today" label="FECHA DEL TURNO" @change="onDateChange" />

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
            @change="onDoctorChange"
          >
            <option value="" disabled>Seleccioná un médico</option>
            <option v-for="m in medicos" :key="m.id" :value="m.id">{{ m.nombre }} {{ m.apellido }}</option>
          </select>
          <AppIcon name="chevron-down" :size="16" class="trail" />
        </div>
      </section>

      <section class="group">
        <div class="slots-head">
          <h3 class="label">Horario disponible <span class="req">*</span></h3>
          <span class="duration">{{ selectedSlot?.duracionMinutos ?? 30 }} min</span>
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
        <p v-else-if="slots.length === 0" class="empty">
          No hay horarios disponibles para
          <strong>{{ medicoActual ? `${medicoActual.nombre} ${medicoActual.apellido}` : 'este médico' }}</strong>
          el {{ longDateLabel(fecha).toLowerCase() }}. Probá con otro día.
        </p>
        <div v-else class="grid" role="group" aria-label="Horarios disponibles">
          <button
            v-for="slot in slots"
            :key="slot.id"
            type="button"
            class="time"
            :class="{ selected: slot.id === selectedId }"
            :aria-pressed="slot.id === selectedId"
            :title="slot.urgente ? 'Entreturno de 15 minutos' : undefined"
            @click="pickSlot(slot)"
          >
            {{ clinicTime(slot.fechaHora) }}
            <AppIcon v-if="slot.id === selectedId" name="check" :size="15" />
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
      <p class="note"><AppIcon name="check" :size="13" /> Al confirmar quedará <strong>Programado</strong> y bloqueado.</p>
    </template>
  </SideDrawer>
</template>

<style scoped>
.form { display: grid; gap: 22px; }
.group { display: grid; gap: 8px; }
/* display: block anula el "grid" global de los <label>, que mandaba el asterisco a otra línea. */
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
