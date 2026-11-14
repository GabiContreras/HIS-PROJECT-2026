<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppIcon from '../../components/ui/AppIcon.vue';
import NoticeBanner from '../../components/ui/NoticeBanner.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import StatCard from '../../components/ui/StatCard.vue';
import StatusChip from '../../components/ui/StatusChip.vue';
import type { EsperaItem, EstadoTurno, SlotDisponible, TurnoAgenda } from '../../services/turnos';
import { listarUsuarios } from '../../services/users';
import { messageFrom } from '../../shared/errors';
import { useFeedback } from '../../composables/useFeedback';
import { useSessionStore } from '../iam/session.store';
import { doctorName, ESTADO_LABELS, isShortened, patientName } from './appointment-ui';
import AppointmentDetailPanel from './AppointmentDetailPanel.vue';
import AvailableSlotsPanel from './AvailableSlotsPanel.vue';
import { addDays, clinicEndTime, clinicTime, longDateLabel, todayInClinic } from './clinic-hours';
import DayPicker from './DayPicker.vue';
import NewAppointmentPanel, { type DoctorOption } from './NewAppointmentPanel.vue';
import { useAppointments } from './useAppointments';

const session = useSessionStore();
const { fecha, medicoId, turnos, libres, espera, promovido, cargando, error, actuando, errorAccion, cargar, puedePasar, transicionar, quitarEspera: quitarDeEspera } =
  useAppointments();
const { toast, confirm, notify } = useFeedback();

const isAdmin = computed(() => session.role === 'ADMINISTRATIVO');
const medicos = ref<DoctorOption[]>([]);
const medicosError = ref<string | null>(null);

// El médico solo ve y gestiona su propia agenda.
if (!isAdmin.value && session.account) medicoId.value = session.account.id;
const medicoFijo = computed(() => (isAdmin.value ? null : (session.account?.id ?? null)));
const medicosPanel = computed<DoctorOption[]>(() => {
  if (isAdmin.value) return medicos.value;
  const cuenta = session.account;
  return cuenta ? [{ id: cuenta.id, nombre: cuenta.nombre, apellido: cuenta.apellido }] : [];
});

// Paneles laterales.
const panelAbierto = ref(false);
const horarioElegido = ref<SlotDisponible | null>(null);
const horariosAbierto = ref(false);
const detalleAbierto = ref(false);
const detalleTurno = ref<TurnoAgenda | null>(null);

// Columnas del tablero. "Programado" es el nombre de las HU para RESERVADO.
const COLUMNAS: { estado: EstadoTurno; tono: string }[] = [
  { estado: 'RESERVADO', tono: 'info' },
  { estado: 'CONFIRMADO', tono: 'success' },
  { estado: 'EN_SALA_DE_ESPERA', tono: 'warning' },
  { estado: 'ATENDIDO', tono: 'dark' },
  { estado: 'CANCELADO', tono: 'danger' },
];
const porEstado = (estado: EstadoTurno) =>
  turnos.value.filter((t) => t.estado === estado).sort((a, b) => a.fechaHora.localeCompare(b.fechaHora));

// Tarjetas de resumen (solo lo que se puede calcular con datos reales).
const activos = computed(() => turnos.value.filter((t) => t.estado !== 'CANCELADO').length);
const enSala = computed(() => porEstado('EN_SALA_DE_ESPERA').length);
const atendidos = computed(() => porEstado('ATENDIDO').length);
const cancelados = computed(() => porEstado('CANCELADO').length);
const porcentajeAtendidos = computed(() => (activos.value ? Math.round((atendidos.value / activos.value) * 100) : 0));

const esHoy = computed(() => fecha.value === todayInClinic());
const VISIBLES = 8;
const libresVisibles = computed(() => libres.value.slice(0, VISIBLES));

// --- Drag & drop (nativo; en pantallas táctiles quedan los botones de cada tarjeta) ---
const arrastrando = ref<TurnoAgenda | null>(null);
const sobre = ref<EstadoTurno | null>(null);

/** Resaltado durante el arrastre: a qué columnas puede ir la tarjeta según el backend. */
function estadoColumna(estado: EstadoTurno): 'valida' | 'invalida' | '' {
  const t = arrastrando.value;
  if (!t || t.estado === estado) return '';
  return puedePasar(t.estado, estado) ? 'valida' : 'invalida';
}

function iniciarArrastre(event: DragEvent, turno: TurnoAgenda): void {
  arrastrando.value = turno;
  event.dataTransfer?.setData('text/plain', turno.id);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}

function terminarArrastre(): void {
  arrastrando.value = null;
  sobre.value = null;
}

async function soltar(estado: EstadoTurno): Promise<void> {
  const turno = arrastrando.value;
  terminarArrastre();
  if (!turno || turno.estado === estado) return;
  await mover(turno, estado);
}

/**
 * Se pide la transición aunque el destino parezca inválido: la regla vive en el backend y su
 * mensaje de negocio (HU 2.1) es el que se le muestra a la persona.
 */
async function mover(turno: TurnoAgenda, estado: EstadoTurno): Promise<void> {
  if (estado === 'CANCELADO' && puedePasar(turno.estado, estado)) {
    const hayCola = espera.value.some((e) => e.medico.id === turno.medico.id);
    const confirmado = await confirm({
      title: 'Cancelar turno',
      message: `¿Cancelar el turno de ${patientName(turno)} de las ${clinicTime(turno.fechaHora)}?`,
      consequences: [
        'El horario queda libre.',
        ...(hayCola ? ['El primero de la lista de espera de este médico recibe el horario.'] : []),
      ],
      confirmLabel: 'Cancelar turno',
      cancelLabel: 'Volver',
      tone: 'danger',
    });
    if (!confirmado) return;
  }
  if (await transicionar(turno.id, estado)) {
    toast.success(`Turno de ${patientName(turno)}: ${ESTADO_LABELS[estado].toLowerCase()}.`);
    avisarPromocion();
  } else if (errorAccion.value) {
    toast.warning(errorAccion.value, { title: 'Transición no válida', key: 'transicion-invalida' });
  }
}

/** HU 1.3: un paciente de la lista de espera tomó el horario liberado; recepción tiene que avisarle. */
function avisarPromocion(): void {
  const p = promovido.value;
  if (!p) return;
  promovido.value = null;
  notify({
    level: 'warning',
    category: 'lista_espera',
    title: 'Horario asignado desde la lista de espera',
    detail:
      `${p.paciente.nombre} ${p.paciente.apellido} pasó al turno de las ${clinicTime(p.turno.fechaHora)} ` +
      `con ${p.turno.medico.nombre} ${p.turno.medico.apellido}. Avisale al paciente (llamado o altavoz).`,
    key: `promo:${p.turno.id}`,
    toast: true,
  });
}

async function quitar(entry: EsperaItem): Promise<void> {
  const nombre = `${entry.paciente.nombre} ${entry.paciente.apellido}`;
  const confirmado = await confirm({
    title: 'Quitar de la lista de espera',
    message: `¿Quitar a ${nombre} de la lista de espera?`,
    consequences: ['Si vuelve a anotarse, queda al final de la cola.'],
    confirmLabel: 'Quitar',
    cancelLabel: 'Volver',
    tone: 'warning',
  });
  if (!confirmado) return;
  if (await quitarDeEspera(entry.id)) toast.info(`${nombre} salió de la lista de espera.`);
  else if (errorAccion.value) toast.error(errorAccion.value);
}

function destinosDe(turno: TurnoAgenda): EstadoTurno[] {
  return COLUMNAS.map((c) => c.estado).filter((estado) => puedePasar(turno.estado, estado));
}

// --- Navegación ---
function irA(dias: number): void {
  fecha.value = addDays(fecha.value, dias);
  void cargar();
}

function abrirNuevoTurno(horario: SlotDisponible | null = null): void {
  horarioElegido.value = horario;
  panelAbierto.value = true;
}

function reservarDesdeHorarios(horario: SlotDisponible): void {
  horariosAbierto.value = false;
  abrirNuevoTurno(horario);
}

function verDetalle(turno: TurnoAgenda): void {
  detalleTurno.value = turno;
  detalleAbierto.value = true;
}

function alReservar(mensaje: string): void {
  toast.success(mensaje);
}

async function cargarMedicos(): Promise<void> {
  if (!isAdmin.value) return;
  medicosError.value = null;
  try {
    // El back solo acepta médicos activos: no mostramos los pendientes ni deshabilitados.
    medicos.value = (await listarUsuarios()).filter((u) => u.rol === 'MEDICO' && u.estado === 'ACTIVO');
  } catch (reason) {
    medicosError.value = messageFrom(reason, 'No se pudo cargar la lista de médicos.');
  }
}

onMounted(() => Promise.all([cargar(), cargarMedicos()]));
</script>

<template>
  <div class="page">
    <PageHeader
      :title="isAdmin ? 'Agenda de turnos' : 'Mi agenda'"
      subtitle="Organizá y seguí el flujo de atención del día."
    >
      <div class="day-nav" role="group" aria-label="Día de la agenda">
        <button class="btn btn-secondary icon" type="button" aria-label="Día anterior" @click="irA(-1)">
          <AppIcon name="chevron-left" :size="18" />
        </button>
        <DayPicker v-model="fecha" label="DÍA" class="picker" @change="cargar" />
        <button class="btn btn-secondary icon" type="button" aria-label="Día siguiente" @click="irA(1)">
          <AppIcon name="chevron-right" :size="18" />
        </button>
      </div>
      <label v-if="isAdmin" class="doctor-filter">
        <span class="sr-only">Médico</span>
        <AppIcon name="stethoscope" :size="18" class="lead" />
        <select v-model="medicoId" @change="cargar">
          <option value="">Todos los médicos</option>
          <option v-for="m in medicos" :key="m.id" :value="m.id">{{ m.nombre }} {{ m.apellido }}</option>
        </select>
      </label>
      <button class="btn" type="button" @click="abrirNuevoTurno()">
        <AppIcon name="plus" :size="18" /> Nuevo turno
      </button>
    </PageHeader>

    <div class="stats">
      <StatCard :titulo="esHoy ? 'Turnos de hoy' : 'Turnos del día'" :valor="activos" :detalle="`${libres.length} horarios libres`" tone="brand" />
      <StatCard titulo="En sala de espera" :valor="enSala" detalle="Esperando al médico" tone="warning" />
      <StatCard titulo="Atendidos" :valor="atendidos" :detalle="`${porcentajeAtendidos}% de la agenda`" tone="violet" />
      <StatCard titulo="Cancelados" :valor="cancelados" detalle="Su horario quedó libre" tone="danger" />
    </div>

    <section class="free-strip" aria-label="Horarios libres">
      <span class="strip-icon"><AppIcon name="clock" :size="20" /></span>
      <div class="strip-text">
        <strong>{{ esHoy ? 'Horarios libres hoy' : 'Horarios libres' }}</strong>
        <small>{{ libres.length }} {{ libres.length === 1 ? 'disponible' : 'disponibles' }}</small>
      </div>
      <div class="strip-chips">
        <button
          v-for="s in libresVisibles"
          :key="`${s.medico.id}-${s.fechaHora}`"
          class="chip-time"
          type="button"
          :title="`${s.medico.nombre} ${s.medico.apellido}`"
          @click="abrirNuevoTurno(s)"
        >
          {{ clinicTime(s.fechaHora) }}
        </button>
        <span v-if="libres.length === 0" class="muted">No quedan horarios libres para este día.</span>
      </div>
      <button class="link" type="button" @click="horariosAbierto = true">Ver todos ›</button>
    </section>

    <NoticeBanner v-if="medicosError" tone="error">{{ medicosError }}</NoticeBanner>

    <section class="board-section">
      <header class="board-head">
        <div>
          <h2>Flujo de atención</h2>
          <p class="muted">{{ turnos.length }} {{ turnos.length === 1 ? 'turno' : 'turnos' }} · {{ longDateLabel(fecha) }}</p>
        </div>
        <ul class="legend" aria-label="Referencias">
          <li><span class="swatch regular"></span> Turno regular</li>
          <li><span class="swatch urgent"></span> Entreturno</li>
        </ul>
      </header>

      <NoticeBanner v-if="error" tone="error">
        {{ error }} <button type="button" class="btn-sm" :disabled="cargando" @click="cargar">Reintentar</button>
      </NoticeBanner>
      <p v-else-if="cargando && turnos.length === 0" role="status">Cargando agenda...</p>

      <div v-else class="board">
        <section
          v-for="col in COLUMNAS"
          :key="col.estado"
          class="column"
          :class="[estadoColumna(col.estado), { over: sobre === col.estado }]"
          :aria-label="`${ESTADO_LABELS[col.estado]}: ${porEstado(col.estado).length}`"
          @dragover.prevent="sobre = col.estado"
          @dragleave="sobre = null"
          @drop.prevent="soltar(col.estado)"
        >
          <header class="column-head">
            <span class="dot" :class="col.tono"></span>
            <h3>{{ ESTADO_LABELS[col.estado] }}</h3>
            <span class="count">{{ porEstado(col.estado).length }}</span>
          </header>

          <article
            v-for="t in porEstado(col.estado)"
            :key="t.id"
            class="card-turno"
            :class="{ urgent: t.urgente, dragging: arrastrando?.id === t.id }"
            draggable="true"
            @dragstart="iniciarArrastre($event, t)"
            @dragend="terminarArrastre"
          >
            <header class="card-top">
              <button class="time-btn" type="button" @click="verDetalle(t)">
                <strong>{{ clinicTime(t.fechaHora) }}</strong>
                <small>{{ t.duracionMinutos }} min</small>
              </button>
              <AppIcon name="grip" :size="16" class="grip" />
            </header>
            <p class="who"><strong>{{ patientName(t) }}</strong></p>
            <p class="doc">{{ doctorName(t) }} · hasta {{ clinicEndTime(t.fechaHora, t.duracionMinutos) }}</p>
            <div v-if="t.urgente || isShortened(t)" class="flags">
              <StatusChip v-if="t.urgente" label="Entreturno" tone="warning" />
              <StatusChip v-else :label="`Duración reducida: ${t.duracionMinutos} min`" tone="warning" />
            </div>
            <div v-if="destinosDe(t).length" class="moves">
              <button
                v-for="destino in destinosDe(t)"
                :key="destino"
                class="btn btn-sm"
                :class="destino === 'CANCELADO' ? 'btn-danger' : 'btn-secondary'"
                type="button"
                :disabled="actuando"
                @click="mover(t, destino)"
              >
                {{ destino === 'CANCELADO' ? 'Cancelar' : `→ ${ESTADO_LABELS[destino]}` }}
              </button>
            </div>
          </article>

          <p v-if="porEstado(col.estado).length === 0" class="empty">Sin turnos</p>
        </section>
      </div>
      <p class="hint foot">
        <AppIcon name="grip" :size="14" /> Arrastrá cada turno para actualizar su estado. Solo se habilitan las transiciones válidas.
      </p>
    </section>

    <section v-if="espera.length" class="waitlist" aria-label="Lista de espera de entreturnos">
      <h2>Lista de espera</h2>
      <p class="muted">
        Si alguien cancela este día, el horario liberado se le asigna automáticamente al primero de la lista.
      </p>
      <ol>
        <li v-for="e in espera" :key="e.id">
          <span class="pos">{{ e.posicion }}</span>
          <span class="name"><strong>{{ e.paciente.nombre }} {{ e.paciente.apellido }}</strong>
            <small>Dr/a. {{ e.medico.apellido }}</small></span>
          <button class="btn btn-sm btn-secondary" type="button" :disabled="actuando" @click="quitar(e)">
            Quitar
          </button>
        </li>
      </ol>
    </section>

    <AvailableSlotsPanel
      :open="horariosAbierto"
      :medicos="medicosPanel"
      :locked-medico-id="medicoFijo"
      @close="horariosAbierto = false"
      @book="reservarDesdeHorarios"
    />

    <NewAppointmentPanel
      :open="panelAbierto"
      :medicos="medicosPanel"
      :prefill="horarioElegido"
      :locked-medico-id="medicoFijo"
      @close="panelAbierto = false"
      @reserved="alReservar"
      @changed="cargar"
    />

    <AppointmentDetailPanel :open="detalleAbierto" :turno="detalleTurno" @close="detalleAbierto = false" />
  </div>
</template>

<style scoped>
.day-nav { display: flex; align-items: center; gap: 6px; }
.day-nav .icon { padding: 10px; }
.day-nav .picker { min-width: 250px; }
.doctor-filter { position: relative; display: block; }
.doctor-filter select { appearance: none; padding: 12px 36px 12px 40px; border-radius: 10px; font-weight: 500; min-width: 210px; }
.doctor-filter .lead { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--color-muted); pointer-events: none; }

.free-strip { display: flex; align-items: center; gap: 16px; padding: 14px 18px; border: 1px solid #b7d9d1; border-radius: 14px; background: var(--color-brand-soft); }
.strip-icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 10px; background: #fff; color: var(--color-brand); flex: none; }
.strip-text { display: grid; line-height: 1.3; flex: none; padding-right: 16px; border-right: 1px solid #b7d9d1; }
.strip-text small { color: var(--color-muted); }
.strip-chips { display: flex; flex-wrap: wrap; gap: 8px; flex: 1; min-width: 0; }
.chip-time { padding: 7px 14px; border: 1px solid var(--color-line); border-radius: 8px; background: #fff; font-weight: 600; font-variant-numeric: tabular-nums; }
.chip-time:hover { border-color: var(--color-brand); background: var(--color-brand-soft); }
.link { border: 0; background: none; color: var(--color-brand-dark); font-weight: 700; white-space: nowrap; }

.board-section { display: grid; gap: 14px; }
.board-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.board-head h2 { margin: 0; font-size: 1.15rem; }
.legend { display: flex; gap: 16px; list-style: none; margin: 0; padding: 0; font-size: 0.78rem; color: var(--color-muted); }
.legend li { display: inline-flex; align-items: center; gap: 6px; }
.swatch { width: 10px; height: 10px; border-radius: 2px; }
.swatch.regular { background: var(--color-brand); }
.swatch.urgent { background: #d49a2e; }

.board { display: grid; grid-template-columns: repeat(5, minmax(210px, 1fr)); gap: 14px; overflow-x: auto; padding-bottom: 6px; }
.column { display: grid; align-content: start; gap: 10px; min-height: 280px; padding: 12px; border: 1px solid var(--color-line); border-radius: 14px; background: #f3f6f5; transition: background 0.12s, border-color 0.12s, opacity 0.12s; }
.column.valida { border-color: var(--color-brand); background: var(--color-brand-soft); }
.column.invalida { opacity: 0.55; }
.column.over.valida { box-shadow: 0 0 0 3px var(--color-brand-soft); }
.column-head { display: flex; align-items: center; gap: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--color-line); }
.column-head h3 { flex: 1; margin: 0; font-family: var(--font); font-size: 0.85rem; font-weight: 700; letter-spacing: 0; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #9aa5a1; }
.dot.info { background: #4c6fbf; } .dot.success { background: var(--color-brand); } .dot.warning { background: #d49a2e; }
.dot.dark { background: #6b7c76; } .dot.danger { background: #c9534b; }
.count { min-width: 24px; padding: 2px 8px; border-radius: 99px; background: #fff; border: 1px solid var(--color-line); font-size: 0.72rem; font-weight: 700; text-align: center; }

.card-turno { display: grid; gap: 6px; padding: 12px; border: 1px solid var(--color-line); border-left: 4px solid var(--color-brand); border-radius: 12px; background: #fff; cursor: grab; }
.card-turno.urgent { border-left-color: #d49a2e; }
.card-turno.dragging { opacity: 0.45; cursor: grabbing; }
.card-top { display: flex; justify-content: space-between; align-items: center; }
.time-btn { display: inline-flex; align-items: baseline; gap: 6px; padding: 0; border: 0; background: none; font-variant-numeric: tabular-nums; }
.time-btn strong { font-size: 1.1rem; }
.time-btn small, .doc { color: var(--color-muted); font-size: 0.75rem; }
.grip { color: #aab5b1; }
.who { margin: 0; font-size: 0.9rem; }
.doc { margin: 0; }
.flags { display: flex; flex-wrap: wrap; gap: 6px; }
.moves { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 6px; border-top: 1px solid var(--color-line); }
.empty { margin: 4px 0; color: #9aa5a1; font-size: 0.8rem; text-align: center; }
.foot { display: flex; align-items: center; justify-content: center; gap: 6px; }


.waitlist { display: grid; gap: 8px; padding: 16px 18px; border: 1px solid var(--color-line); border-radius: 14px; background: #fff; }
.waitlist h2 { margin: 0; font-size: 1.05rem; }
.waitlist p { margin: 0; font-size: 0.85rem; }
.waitlist ol { display: grid; gap: 8px; margin: 4px 0 0; padding: 0; list-style: none; }
.waitlist li { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border: 1px solid var(--color-line); border-radius: 10px; }
.waitlist .pos { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--color-brand-soft); color: var(--color-brand-dark); font-weight: 700; font-size: 0.8rem; }
.waitlist .name { display: grid; flex: 1; line-height: 1.3; }
.waitlist .name small { color: var(--color-muted); }

@media (max-width: 760px) {
  .free-strip { flex-wrap: wrap; }
  .strip-text { border-right: 0; padding-right: 0; }
}
</style>
