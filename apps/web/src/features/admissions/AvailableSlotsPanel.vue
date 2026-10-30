<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppIcon from '../../components/ui/AppIcon.vue';
import NoticeBanner from '../../components/ui/NoticeBanner.vue';
import SideDrawer from '../../components/ui/SideDrawer.vue';
import { listarAgenda, type TurnoAgenda } from '../../services/turnos';
import { messageFrom } from '../../shared/errors';
import { ESTADO_LABELS, isShortened } from './appointment-ui';
import AppointmentDetailPanel from './AppointmentDetailPanel.vue';
import { clinicTime, dayRange, longDateLabel, todayInClinic } from './clinic-hours';
import DayPicker from './DayPicker.vue';
import type { DoctorOption } from './NewAppointmentPanel.vue';

const props = defineProps<{
  open: boolean;
  medicos: DoctorOption[];
  /** Si la persona es médico, solo ve su propia agenda. */
  lockedMedicoId: string | null;
}>();

const emit = defineEmits<{
  close: [];
  /** Se tocó un horario libre: la pantalla abre "Nuevo turno" con ese turno cargado. */
  book: [turno: TurnoAgenda];
}>();

const today = todayInClinic();
const fecha = ref(today);
// '' significa "Todos los médicos".
const medicoId = ref('');
const turnos = ref<TurnoAgenda[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const now = ref(Date.now());

// Detalle de un turno ocupado: se abre encima de este panel sin cerrarlo.
const detalleAbierto = ref(false);
const detalleTurno = ref<TurnoAgenda | null>(null);

let request = 0;

interface Group {
  medico: DoctorOption;
  turnos: TurnoAgenda[];
  libres: number;
  ocupados: number;
}

const isPast = (t: TurnoAgenda) => new Date(t.fechaHora).getTime() <= now.value;
const isFree = (t: TurnoAgenda) => t.estado === 'DISPONIBLE';

const groups = computed<Group[]>(() => {
  const byDoctor = new Map<string, Group>();
  for (const t of turnos.value) {
    let group = byDoctor.get(t.medico.id);
    if (!group) {
      group = { medico: t.medico, turnos: [], libres: 0, ocupados: 0 };
      byDoctor.set(t.medico.id, group);
    }
    group.turnos.push(t);
    if (isFree(t)) {
      if (!isPast(t)) group.libres += 1;
    } else {
      group.ocupados += 1;
    }
  }
  const order = new Map(props.medicos.map((m, index) => [m.id, index]));
  return [...byDoctor.values()]
    .map((g) => ({ ...g, turnos: [...g.turnos].sort((a, b) => a.fechaHora.localeCompare(b.fechaHora)) }))
    .sort(
      (a, b) =>
        (order.get(a.medico.id) ?? 999) - (order.get(b.medico.id) ?? 999) ||
        a.medico.apellido.localeCompare(b.medico.apellido),
    );
});

const emptyWho = computed(() => {
  const chosen = props.medicos.find((m) => m.id === medicoId.value);
  return chosen ? `${chosen.nombre} ${chosen.apellido}` : '';
});
const total = computed(() => groups.value.reduce((n, g) => n + g.libres, 0));
const hasAny = computed(() => turnos.value.length > 0);

async function load(): Promise<void> {
  const current = ++request;
  loading.value = true;
  error.value = null;
  now.value = Date.now();
  try {
    const found = await listarAgenda({ medicoId: medicoId.value || undefined, ...dayRange(fecha.value) });
    if (current === request) turnos.value = found;
  } catch (reason) {
    if (current === request) error.value = messageFrom(reason, 'No se pudieron cargar los horarios.');
  } finally {
    if (current === request) loading.value = false;
  }
}

watch(
  () => props.open,
  (isOpen) => {
    // Al abrir o cerrar, el detalle queda cerrado: no tiene que reaparecer la próxima vez.
    detalleAbierto.value = false;
    if (!isOpen) return;
    fecha.value = todayInClinic();
    medicoId.value = props.lockedMedicoId ?? '';
    turnos.value = [];
    void load();
  },
);

function pick(turno: TurnoAgenda): void {
  if (isFree(turno)) {
    if (!isPast(turno)) emit('book', turno);
    return;
  }
  detalleTurno.value = turno;
  detalleAbierto.value = true;
}

function doctorLabel(m: DoctorOption): string {
  return `${m.nombre} ${m.apellido}`;
}

function cellLabel(t: TurnoAgenda): string {
  if (isFree(t)) return isPast(t) ? 'Pasó' : 'Libre';
  return t.paciente?.apellido ?? ESTADO_LABELS[t.estado];
}

function cellClass(t: TurnoAgenda): string {
  if (isFree(t)) return isPast(t) ? 'past' : 'free';
  return t.estado === 'CANCELADO' ? 'cancelled' : 'busy';
}

function cellAria(t: TurnoAgenda): string {
  const time = clinicTime(t.fechaHora);
  if (isFree(t)) return isPast(t) ? `${time}, libre pero ya pasó` : `${time}, libre. Reservar turno`;
  const who = t.paciente ? `${t.paciente.nombre} ${t.paciente.apellido}, ` : '';
  return `${time}, ${who}${ESTADO_LABELS[t.estado]}. Ver detalle`;
}
</script>

<template>
  <SideDrawer
    :open="open"
    title="Horarios disponibles"
    subtitle="Tocá uno libre para reservar o uno ocupado para ver el detalle"
    @close="emit('close')"
  >
    <template #icon><AppIcon name="clock" :size="22" /></template>

    <div class="stack">
      <section class="filters">
        <label class="label" for="slots-doctor">Médico</label>
        <div class="select-wrap">
          <AppIcon name="stethoscope" :size="18" class="lead" />
          <select id="slots-doctor" v-model="medicoId" :disabled="!!lockedMedicoId" @change="load">
            <option value="">Todos los médicos</option>
            <option v-for="m in medicos" :key="m.id" :value="m.id">{{ doctorLabel(m) }}</option>
          </select>
          <AppIcon name="chevron-down" :size="16" class="trail" />
        </div>
        <DayPicker v-model="fecha" :min="today" label="DÍA" @change="load" />
      </section>

      <ul class="legend" aria-label="Referencias">
        <li><span class="dot free"></span> Libre</li>
        <li><span class="dot busy"></span> Ocupado</li>
        <li><span class="dot cancelled"></span> Cancelado</li>
        <li><span class="dot flag"></span> Entreturno o duración reducida</li>
      </ul>

      <NoticeBanner v-if="error" tone="error">
        {{ error }} <button type="button" class="btn-sm" @click="load">Reintentar</button>
      </NoticeBanner>

      <div v-else-if="loading && !hasAny" class="skeletons" role="status" aria-busy="true">
        <span v-for="n in 8" :key="n" class="skeleton"></span>
        <span class="sr-only">Cargando horarios...</span>
      </div>

      <p v-else-if="!hasAny" class="empty">
        No hay turnos creados<template v-if="emptyWho"> para <strong>{{ emptyWho }}</strong></template>
        el {{ longDateLabel(fecha).toLowerCase() }}. Probá con otro día.
      </p>

      <template v-else>
        <p class="summary" role="status">
          {{ total }} {{ total === 1 ? 'horario libre' : 'horarios libres' }} para reservar
          <span v-if="loading" class="hint"> · actualizando...</span>
        </p>

        <section v-for="g in groups" :key="g.medico.id" class="group">
          <header class="group-head">
            <h3>{{ doctorLabel(g.medico) }}</h3>
            <span class="counts">{{ g.libres }} {{ g.libres === 1 ? 'libre' : 'libres' }} · {{ g.ocupados }} {{ g.ocupados === 1 ? 'ocupado' : 'ocupados' }}</span>
          </header>
          <div class="grid" role="group" :aria-label="`Horarios de ${doctorLabel(g.medico)}`">
            <button
              v-for="t in g.turnos"
              :key="t.id"
              type="button"
              class="cell"
              :class="cellClass(t)"
              :disabled="isFree(t) && isPast(t)"
              :aria-label="cellAria(t)"
              :title="t.urgente ? 'Entreturno de 15 minutos' : isShortened(t) ? 'Duración reducida' : undefined"
              @click="pick(t)"
            >
              <span v-if="t.urgente || isShortened(t)" class="flag" aria-hidden="true"></span>
              <span class="time">{{ clinicTime(t.fechaHora) }}</span>
              <span class="tag">{{ cellLabel(t) }}</span>
            </button>
          </div>
        </section>
      </template>
    </div>

    <template #footer>
      <button type="button" class="btn btn-secondary close-btn" @click="emit('close')">Cerrar</button>
    </template>

    <AppointmentDetailPanel :open="detalleAbierto" :turno="detalleTurno" @close="detalleAbierto = false" />
  </SideDrawer>
</template>

<style scoped>
.stack { display: grid; gap: 18px; }
.filters { display: grid; gap: 10px; }
.label { display: block; font-family: var(--font); font-size: 0.88rem; font-weight: 700; letter-spacing: 0; }
.select-wrap { position: relative; }
.select-wrap select { appearance: none; padding: 12px 40px 12px 42px; border-radius: 10px; font-weight: 500; }
.select-wrap .lead { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--color-muted); pointer-events: none; }
.select-wrap .trail { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: var(--color-muted); pointer-events: none; }

.legend { list-style: none; display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0; padding: 0; font-size: 0.75rem; color: var(--color-muted); }
.legend li { display: inline-flex; align-items: center; gap: 6px; }
.dot { width: 10px; height: 10px; border-radius: 3px; border: 1px solid var(--color-line); background: #fff; }
.dot.busy { background: var(--color-info-soft); border-color: #9cc6d3; }
.dot.cancelled { background: var(--color-danger-soft); border-color: #f1c6c0; }
.dot.flag { background: #d49a2e; border-color: #d49a2e; border-radius: 50%; width: 8px; height: 8px; }

.summary { font-size: 0.85rem; font-weight: 600; color: var(--color-brand-dark); }
.group { display: grid; gap: 10px; }
.group-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding-bottom: 6px; border-bottom: 1px solid var(--color-line); }
.group-head h3 { font-family: var(--font); font-size: 0.95rem; font-weight: 700; letter-spacing: 0; }
.counts { color: var(--color-muted); font-size: 0.75rem; white-space: nowrap; }

.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.cell { position: relative; display: grid; gap: 1px; justify-items: center; padding: 8px 4px; min-height: 54px; border-radius: 10px;
  border: 1px solid var(--color-line); background: #fff; font-weight: 600; }
.cell .time { font-size: 0.95rem; font-variant-numeric: tabular-nums; }
.cell .tag { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.68rem; font-weight: 600; color: var(--color-muted); }
.cell.free .tag { color: var(--color-brand); }
.cell.free:hover:not(:disabled) { border-color: var(--color-brand); background: var(--color-brand-soft); }
.cell.busy { background: var(--color-info-soft); border-color: #9cc6d3; color: var(--color-info); }
.cell.busy .tag { color: var(--color-info); }
.cell.busy:hover:not(:disabled) { background: #dcecf1; }
.cell.cancelled { background: var(--color-danger-soft); border-color: #f1c6c0; color: var(--color-danger); }
.cell.cancelled .tag { color: var(--color-danger); }
.cell.past { background: #f3f5f4; color: #9aa5a1; opacity: 1; }
.cell .flag { position: absolute; top: 5px; right: 5px; width: 7px; height: 7px; border-radius: 50%; background: #d49a2e; }

.skeletons { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.skeleton { height: 54px; border-radius: 10px; background: linear-gradient(90deg, #eef1f0, #f7f9f8, #eef1f0); }
.empty { padding: 14px; border: 1px dashed var(--color-line); border-radius: 10px; color: var(--color-muted); font-size: 0.85rem; }
.close-btn { width: 100%; padding: 12px; }

@media (max-width: 520px) {
  .grid, .skeletons { grid-template-columns: repeat(3, 1fr); }
}
</style>
