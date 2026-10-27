<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { listarUsuarios, type Usuario } from '../../services/users';
import type { EstadoTurno } from '../../services/turnos';
import { ApiError } from '../../shared/http';
import { useSessionStore } from '../iam/session.store';
import { useAppointments } from './useAppointments';

const session = useSessionStore();
const { turnos, cargando, error, cargar, crear, transicionar } = useAppointments();
const medicos = reactive<Usuario[]>([]);
const medicosError = ref<string | null>(null);
const form = reactive({ medicoId: session.account?.id ?? '', fechaHora: '' });
const canCreate = computed(() => session.role === 'MEDICO' || session.role === 'ADMINISTRATIVO');

const transitions: Partial<Record<EstadoTurno, { label: string; next: EstadoTurno }[]>> = {
  RESERVADO: [
    { label: 'Confirmar', next: 'CONFIRMADO' },
    { label: 'Cancelar', next: 'CANCELADO' },
  ],
  CONFIRMADO: [
    { label: 'Marcar atendido', next: 'ATENDIDO' },
    { label: 'Cancelar', next: 'CANCELADO' },
  ],
};

async function cargarMedicos(): Promise<void> {
  if (session.role !== 'ADMINISTRATIVO') return;
  medicosError.value = null;
  try {
    const usuarios = await listarUsuarios();
    medicos.push(...usuarios.filter((usuario) => usuario.rol === 'MEDICO'));
  } catch (reason) {
    medicosError.value =
      reason instanceof ApiError ? reason.message : 'No se pudo cargar la lista de médicos.';
  }
}

async function crearFranja(): Promise<void> {
  if (await crear({ ...form })) form.fechaHora = '';
}

onMounted(async () => {
  await Promise.all([cargar(), cargarMedicos()]);
});
</script>

<template>
  <section>
    <header class="page-header">
      <div>
        <h1>Agenda de turnos</h1>
        <p>Creá franjas y gestioná las transiciones de atención permitidas.</p>
      </div>
    </header>

    <form v-if="canCreate" class="slot-form" @submit.prevent="crearFranja">
      <label v-if="session.role === 'ADMINISTRATIVO'">
        Médico
        <select v-model="form.medicoId" required>
          <option value="" disabled>Seleccioná un médico</option>
          <option v-for="medico in medicos" :key="medico.id" :value="medico.id">
            {{ medico.nombre }} {{ medico.apellido }}
          </option>
        </select>
      </label>
      <label>
        Fecha y hora
        <input v-model="form.fechaHora" type="datetime-local" step="1800" required />
      </label>
      <button type="submit" :disabled="cargando || !form.medicoId">
        {{ cargando ? 'Guardando...' : 'Crear franja' }}
      </button>
    </form>
    <p v-if="medicosError" class="error" role="alert">{{ medicosError }}</p>

    <p v-if="error" class="error" role="alert">
      {{ error }}
      <button type="button" :disabled="cargando" @click="cargar">Reintentar</button>
    </p>
    <p v-else-if="cargando" role="status">Cargando agenda...</p>
    <p v-else-if="turnos.length === 0">No hay turnos para mostrar.</p>
    <table v-else>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Médico</th>
          <th>Paciente</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="turno in turnos" :key="turno.id">
          <td>{{ new Date(turno.fechaHora).toLocaleString('es-AR') }}</td>
          <td>{{ turno.medico.nombre }} {{ turno.medico.apellido }}</td>
          <td>{{ turno.paciente ? `${turno.paciente.nombre} ${turno.paciente.apellido}` : 'Sin asignar' }}</td>
          <td>{{ turno.estado }}</td>
          <td>
            <button
              v-for="transition in transitions[turno.estado]"
              :key="transition.next"
              type="button"
              :disabled="cargando"
              @click="transicionar(turno.id, transition.next)"
            >
              {{ transition.label }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.page-header { margin-bottom: var(--space-4); }
.page-header h1, .page-header p { margin: 0; }
.page-header p { margin-top: var(--space-1); }
.slot-form { display: flex; flex-wrap: wrap; align-items: end; gap: var(--space-3); margin-bottom: var(--space-4); }
label { display: grid; gap: var(--space-1); }
input, select, button { font: inherit; padding: 8px; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: var(--space-2); border-bottom: 1px solid var(--color-border); text-align: left; }
td button + button { margin-left: var(--space-1); }
.error { color: #9c2020; }
</style>
