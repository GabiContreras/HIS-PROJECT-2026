<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import AppIcon from '../../components/ui/AppIcon.vue';
import BaseCard from '../../components/ui/BaseCard.vue';
import NoticeBanner from '../../components/ui/NoticeBanner.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import StatCard from '../../components/ui/StatCard.vue';
import StatusChip from '../../components/ui/StatusChip.vue';
import type { EstadoTurno, TurnoAgenda } from '../../services/turnos';
import { listarUsuarios, type Usuario } from '../../services/users';
import { messageFrom } from '../../shared/errors';
import { formatDateTime } from '../../shared/format';
import { useSessionStore } from '../iam/session.store';
import { doctorName, ESTADO_LABELS, ESTADO_TONES, isShortened, patientName } from './appointment-ui';
import AvailableSlotsPanel from './AvailableSlotsPanel.vue';
import NewAppointmentPanel, { type DoctorOption } from './NewAppointmentPanel.vue';
import { useAppointments } from './useAppointments';

const session = useSessionStore();
const { turnos, cargando, error, actuando, errorAccion, cargar, crear, crearEntreturno, transicionar } = useAppointments();

const isAdmin = computed(() => session.role === 'ADMINISTRATIVO');
const medicos = ref<Usuario[]>([]);
const medicosError = ref<string | null>(null);
const aviso = ref<string | null>(null);
const filtro = ref<EstadoTurno | ''>('');

const slotForm = reactive({ medicoId: session.account?.id ?? '', fechaHora: '' });
const urgentForm = reactive({ medicoId: session.account?.id ?? '', fechaHora: '' });

// Panel lateral "Nuevo turno". Si se abre desde una fila de la tabla, llega con ese turno ya elegido.
const panelAbierto = ref(false);
const turnoElegido = ref<TurnoAgenda | null>(null);
// Panel lateral "Ver horarios disponibles".
const horariosAbierto = ref(false);

// El médico solo puede sacar turnos en su propia agenda; el administrativo elige entre los médicos activos.
const medicosPanel = computed<DoctorOption[]>(() => {
  if (isAdmin.value) return medicos.value;
  const cuenta = session.account;
  return cuenta ? [{ id: cuenta.id, nombre: cuenta.nombre, apellido: cuenta.apellido }] : [];
});
const medicoFijo = computed(() => (isAdmin.value ? null : (session.account?.id ?? null)));

const nowInput = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

const transitions: Partial<Record<EstadoTurno, { label: string; next: EstadoTurno; danger?: boolean }[]>> = {
  RESERVADO: [
    { label: 'Confirmar', next: 'CONFIRMADO' },
    { label: 'Cancelar', next: 'CANCELADO', danger: true },
  ],
  CONFIRMADO: [
    { label: 'Marcar atendido', next: 'ATENDIDO' },
    { label: 'Cancelar', next: 'CANCELADO', danger: true },
  ],
};

const visibles = computed(() => (filtro.value ? turnos.value.filter((t) => t.estado === filtro.value) : turnos.value));
const count = (estado: EstadoTurno) => turnos.value.filter((t) => t.estado === estado).length;

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

// El navegador interpreta el campo en hora local: se envía con zona horaria explícita.
const toIso = (local: string) => new Date(local).toISOString();

async function crearFranja(): Promise<void> {
  aviso.value = null;
  if (await crear({ medicoId: slotForm.medicoId, fechaHora: toIso(slotForm.fechaHora) })) {
    slotForm.fechaHora = '';
    aviso.value = 'Franja creada correctamente.';
  }
}

async function insertarEntreturno(): Promise<void> {
  aviso.value = null;
  if (await crearEntreturno({ medicoId: urgentForm.medicoId, fechaHora: toIso(urgentForm.fechaHora) })) {
    urgentForm.fechaHora = '';
    aviso.value = 'Entreturno insertado. Los turnos adyacentes quedaron con duración reducida.';
  }
}

function abrirNuevoTurno(turno: TurnoAgenda | null = null): void {
  aviso.value = null;
  turnoElegido.value = turno;
  panelAbierto.value = true;
}

/** Se tocó un horario libre en "Ver horarios disponibles": se pasa a Nuevo turno con ese horario cargado. */
function reservarDesdeHorarios(turno: TurnoAgenda): void {
  horariosAbierto.value = false;
  abrirNuevoTurno(turno);
}

function alReservar(nombrePaciente: string): void {
  aviso.value = `Turno reservado para ${nombrePaciente}. Estado: Programado.`;
}

async function cambiarEstado(turno: TurnoAgenda, estado: EstadoTurno): Promise<void> {
  aviso.value = null;
  if (await transicionar(turno.id, estado)) aviso.value = `Turno ${ESTADO_LABELS[estado].toLowerCase()}.`;
}

onMounted(() => Promise.all([cargar(), cargarMedicos()]));
</script>

<template>
  <div class="page">
    <PageHeader
      :title="isAdmin ? 'Agenda de turnos' : 'Mi agenda'"
      subtitle="Creá franjas, reservá turnos para pacientes registrados y gestioná la atención."
    >
      <button class="btn btn-secondary" type="button" @click="horariosAbierto = true">
        <AppIcon name="clock" :size="18" /> Ver horarios disponibles
      </button>
      <button class="btn" type="button" @click="abrirNuevoTurno()">
        <AppIcon name="plus" :size="18" /> Nuevo turno
      </button>
    </PageHeader>

    <div class="stats">
      <StatCard titulo="Disponibles" :valor="count('DISPONIBLE')" detalle="Franjas libres" tone="brand" />
      <StatCard titulo="Programados" :valor="count('RESERVADO')" detalle="Reservados, sin confirmar" tone="info" />
      <StatCard titulo="Confirmados" :valor="count('CONFIRMADO')" detalle="Esperando atención" tone="violet" />
      <StatCard titulo="Atendidos" :valor="count('ATENDIDO')" detalle="Generan cargo de facturación" tone="warning" />
    </div>

    <NoticeBanner v-if="aviso" tone="success">{{ aviso }}</NoticeBanner>
    <NoticeBanner v-if="errorAccion" tone="error" title="No se pudo completar la acción">
      {{ errorAccion }} La agenda se actualizó con los datos más recientes.
    </NoticeBanner>
    <NoticeBanner v-if="medicosError" tone="error">{{ medicosError }}</NoticeBanner>

    <div class="grid-eq">
      <BaseCard>
        <template #header><h3>Crear franja</h3></template>
        <form class="inline-form" @submit.prevent="crearFranja">
          <label v-if="isAdmin">
            Médico
            <select v-model="slotForm.medicoId" required>
              <option value="" disabled>Seleccioná un médico</option>
              <option v-for="m in medicos" :key="m.id" :value="m.id">{{ m.nombre }} {{ m.apellido }}</option>
            </select>
          </label>
          <label>
            Fecha y hora
            <input v-model="slotForm.fechaHora" type="datetime-local" step="1800" :min="nowInput()" required />
            <span class="hint">Franjas de 30 minutos (minutos 00 o 30).</span>
          </label>
          <button class="btn" type="submit" :disabled="actuando || !slotForm.medicoId">Crear franja</button>
        </form>
      </BaseCard>

      <BaseCard>
        <template #header><h3>Insertar entreturno</h3></template>
        <form class="inline-form" @submit.prevent="insertarEntreturno">
          <label v-if="isAdmin">
            Médico
            <select v-model="urgentForm.medicoId" required>
              <option value="" disabled>Seleccioná un médico</option>
              <option v-for="m in medicos" :key="m.id" :value="m.id">{{ m.nombre }} {{ m.apellido }}</option>
            </select>
          </label>
          <label>
            Fecha y hora
            <input v-model="urgentForm.fechaHora" type="datetime-local" step="900" :min="nowInput()" required />
            <span class="hint">Entre dos turnos de 30 min, a los :15 o :45. Acorta los turnos de al lado.</span>
          </label>
          <button class="btn btn-secondary" type="submit" :disabled="actuando || !urgentForm.medicoId">Insertar</button>
        </form>
      </BaseCard>
    </div>

    <BaseCard>
      <template #header><h3>Turnos</h3></template>
      <template #action>
        <select v-model="filtro" aria-label="Filtrar por estado" class="filter">
          <option value="">Todos los estados</option>
          <option v-for="(label, estado) in ESTADO_LABELS" :key="estado" :value="estado">{{ label }}</option>
        </select>
      </template>

      <NoticeBanner v-if="error" tone="error">
        {{ error }} <button type="button" class="btn-sm" :disabled="cargando" @click="cargar">Reintentar</button>
      </NoticeBanner>
      <p v-else-if="cargando && turnos.length === 0" role="status">Cargando agenda...</p>
      <p v-else-if="visibles.length === 0" class="muted">No hay turnos para mostrar.</p>
      <div v-else class="scroll-x">
        <table>
          <thead>
            <tr><th>Fecha y hora</th><th>Médico</th><th>Paciente</th><th>Estado</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            <tr v-for="t in visibles" :key="t.id">
              <td>
                <strong>{{ formatDateTime(t.fechaHora) }}</strong>
                <small class="muted"> · {{ t.duracionMinutos }} min</small>
              </td>
              <td>{{ doctorName(t) }}</td>
              <td>{{ patientName(t) }}</td>
              <td>
                <div class="chips">
                  <StatusChip :label="ESTADO_LABELS[t.estado]" :tone="ESTADO_TONES[t.estado]" />
                  <StatusChip v-if="t.urgente" label="Entreturno" tone="warning" />
                  <StatusChip v-else-if="isShortened(t)" label="Tiempo reducido" tone="warning" />
                </div>
              </td>
              <td>
                <div class="actions">
                  <button v-if="t.estado === 'DISPONIBLE'" class="btn btn-sm" type="button" :disabled="actuando" @click="abrirNuevoTurno(t)">
                    Reservar
                  </button>
                  <button
                    v-for="tr in transitions[t.estado]"
                    :key="tr.next"
                    class="btn btn-sm"
                    :class="tr.danger ? 'btn-danger' : 'btn-secondary'"
                    type="button"
                    :disabled="actuando"
                    @click="cambiarEstado(t, tr.next)"
                  >
                    {{ tr.label }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </BaseCard>

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
      :prefill="turnoElegido"
      :locked-medico-id="medicoFijo"
      @close="panelAbierto = false"
      @reserved="alReservar"
      @changed="cargar"
    />
  </div>
</template>

<style scoped>
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.filter { width: auto; padding: 6px 10px; font-size: 0.8rem; }
</style>
