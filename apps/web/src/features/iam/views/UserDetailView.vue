<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import UserStatusChip from '../../../components/UserStatusChip.vue';
import {
  actualizarHorario,
  actualizarUsuario,
  darDeBajaUsuario,
  deshabilitarUsuario,
  habilitarUsuario,
  restaurarUsuario,
  type Usuario,
} from '../../../services/users';
import { formatDateTime } from '../../../shared/format';
import { useSessionStore } from '../session.store';
import { messageFrom } from '../../../shared/errors';
import { useUsers } from '../useUsers';

const route = useRoute();
const userId = computed(() => String(route.params.id));
const session = useSessionStore();
const { usuario, cargando, error, cargarPorId } = useUsers();

// --- Permisos: el superadmin gestiona a todos; un administrativo común no toca a otros administrativos. ---
const soySuperadmin = computed(() => session.account?.esSuperadmin === true);
const esMiCuenta = computed(() => usuario.value?.id === session.account?.id);
const enBaja = computed(() => usuario.value?.estado === 'BAJA');
const puedeGestionar = computed(() => {
  const u = usuario.value;
  if (!u || u.esSuperadmin || u.estado === 'BAJA') return false;
  return soySuperadmin.value || u.rol !== 'ADMINISTRATIVO' || esMiCuenta.value;
});
const puedeHabilitar = computed(
  () => puedeGestionar.value && ['PENDIENTE_HABILITACION', 'DESHABILITADO'].includes(usuario.value?.estado ?? ''),
);
const puedeDeshabilitar = computed(
  () => puedeGestionar.value && !esMiCuenta.value && usuario.value?.estado !== 'DESHABILITADO',
);
const puedeDarDeBaja = computed(
  () => soySuperadmin.value && !!usuario.value && !usuario.value.esSuperadmin && !esMiCuenta.value && !enBaja.value,
);

const accionando = ref(false);
const errorCuenta = ref<string | null>(null);
const avisoCuenta = ref<string | null>(null);
const editando = ref(false);
const nombre = ref('');
const apellido = ref('');

function empezarEdicion(): void {
  if (!usuario.value) return;
  nombre.value = usuario.value.nombre;
  apellido.value = usuario.value.apellido;
  errorCuenta.value = null;
  editando.value = true;
}

async function ejecutar(operation: () => Promise<Usuario>, aviso: string): Promise<void> {
  accionando.value = true;
  errorCuenta.value = null;
  avisoCuenta.value = null;
  try {
    usuario.value = await operation();
    avisoCuenta.value = aviso;
    editando.value = false;
  } catch (reason) {
    errorCuenta.value = messageFrom(reason, 'No se pudo completar la operación.');
  } finally {
    accionando.value = false;
  }
}

const guardarNombre = () =>
  usuario.value && ejecutar(() => actualizarUsuario(usuario.value!.id, { nombre: nombre.value, apellido: apellido.value }), 'Datos actualizados.');
const habilitar = () => usuario.value && ejecutar(() => habilitarUsuario(usuario.value!.id), 'La cuenta quedó habilitada.');
const restaurar = () =>
  usuario.value &&
  ejecutar(() => restaurarUsuario(usuario.value!.id), 'Cuenta restaurada. Quedó deshabilitada: habilitala para que pueda ingresar.');

function deshabilitar(): void {
  if (!usuario.value) return;
  if (!window.confirm(`¿Deshabilitar a ${usuario.value.nombre} ${usuario.value.apellido}? No podrá iniciar sesión hasta que se la habilite de nuevo.`)) return;
  void ejecutar(() => deshabilitarUsuario(usuario.value!.id), 'La cuenta quedó deshabilitada.');
}

function darDeBaja(): void {
  if (!usuario.value) return;
  const u = usuario.value;
  const mensaje =
    `¿Dar de baja a ${u.nombre} ${u.apellido}?\n\n` +
    'La cuenta se archiva: no podrá iniciar sesión y dejará de aparecer en listados. ' +
    'Su historial (turnos, cargos) se conserva y un superadmin puede restaurarla.';
  if (!window.confirm(mensaje)) return;
  void ejecutar(() => darDeBajaUsuario(u.id), 'La cuenta se dio de baja.');
}

// Horario de atención: de 08:00 a 20:00 (horario de la clínica), en bloques de 30 minutos.
const OPCIONES = Array.from({ length: 25 }, (_, i) => {
  const minutos = 8 * 60 + i * 30;
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${minutos % 60 === 0 ? '00' : '30'}`;
});
const horaInicio = ref('08:00');
const horaFin = ref('20:00');
const guardando = ref(false);
const errorHorario = ref<string | null>(null);
const guardado = ref(false);

const horarioValido = computed(() => horaInicio.value < horaFin.value);
const turnosPorDia = computed(() => {
  const minutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
  return Math.max(0, Math.floor((minutos(horaFin.value) - minutos(horaInicio.value)) / 30));
});

watch(userId, async (id) => {
  errorCuenta.value = null;
  avisoCuenta.value = null;
  editando.value = false;
  guardado.value = false;
  errorHorario.value = null;
  if (await cargarPorId(id) && usuario.value) {
    horaInicio.value = usuario.value.horaInicio ?? '08:00';
    horaFin.value = usuario.value.horaFin ?? '20:00';
  }
}, { immediate: true });

async function guardarHorario(): Promise<void> {
  if (!usuario.value || !horarioValido.value) return;
  guardando.value = true;
  guardado.value = false;
  errorHorario.value = null;
  try {
    usuario.value = await actualizarHorario(usuario.value.id, {
      horaInicio: horaInicio.value,
      horaFin: horaFin.value,
    });
    guardado.value = true;
  } catch (reason) {
    errorHorario.value = messageFrom(reason, 'No se pudo guardar el horario.');
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <section>
    <RouterLink :to="{ name: 'users' }">Volver a usuarios</RouterLink>
    <p v-if="cargando" role="status">Cargando usuario...</p>
    <p v-else-if="error" class="error" role="alert">
      {{ error }}
      <button type="button" @click="cargarPorId(userId)">Reintentar</button>
    </p>
    <article v-else-if="usuario" class="card">
      <h1>{{ usuario.nombre }} {{ usuario.apellido }}</h1>
      <dl>
        <div><dt>Correo</dt><dd>{{ usuario.email }}</dd></div>
        <div><dt>Rol</dt><dd>{{ usuario.rol }}</dd></div>
        <div><dt>Estado</dt><dd><UserStatusChip :status="usuario.estado" /></dd></div>
        <div v-if="enBaja && usuario.dadoDeBajaEn"><dt>Dada de baja el</dt><dd>{{ formatDateTime(usuario.dadoDeBajaEn) }}</dd></div>
      </dl>

      <p v-if="enBaja" class="note">
        Esta cuenta está dada de baja: no puede iniciar sesión y no aparece en los listados. Su historial se conserva.
      </p>
      <p v-else-if="usuario.esSuperadmin" class="note">Es el superadmin raíz: no se puede modificar, deshabilitar ni dar de baja.</p>
      <p v-else-if="!puedeGestionar" class="note">Solo el superadmin puede gestionar a otros administrativos.</p>

      <section v-if="puedeGestionar || puedeDarDeBaja || (enBaja && soySuperadmin)" class="account-actions">
        <h2>Acciones de la cuenta</h2>

        <form v-if="editando" class="row" novalidate @submit.prevent="guardarNombre">
          <label>Nombre<input v-model="nombre" maxlength="80" autocomplete="off" /></label>
          <label>Apellido<input v-model="apellido" maxlength="80" autocomplete="off" /></label>
          <button class="btn" type="submit" :disabled="accionando || !nombre.trim() || !apellido.trim()">Guardar</button>
          <button class="btn btn-secondary" type="button" :disabled="accionando" @click="editando = false">Cancelar</button>
        </form>

        <div v-else class="row">
          <button v-if="puedeGestionar" class="btn btn-secondary" type="button" :disabled="accionando" @click="empezarEdicion">Editar nombre</button>
          <button v-if="puedeHabilitar" class="btn" type="button" :disabled="accionando" @click="habilitar">Habilitar</button>
          <button v-if="puedeDeshabilitar" class="btn btn-secondary" type="button" :disabled="accionando" @click="deshabilitar">Deshabilitar</button>
          <button v-if="enBaja && soySuperadmin" class="btn" type="button" :disabled="accionando" @click="restaurar">Restaurar cuenta</button>
          <button v-if="puedeDarDeBaja" class="btn btn-danger" type="button" :disabled="accionando" @click="darDeBaja">Dar de baja</button>
        </div>

        <p v-if="errorCuenta" class="error" role="alert">{{ errorCuenta }}</p>
        <p v-if="avisoCuenta" class="ok" role="status">{{ avisoCuenta }}</p>
      </section>

      <form v-if="usuario.rol === 'MEDICO'" class="schedule" @submit.prevent="guardarHorario">
        <h2>Horario de atención</h2>
        <p class="hint">
          Dentro de este horario se calculan los turnos disponibles (bloques de 30 minutos, sin contar entreturnos).
          La clínica atiende de 08:00 a 20:00.
        </p>
        <div class="row">
          <label>Desde
            <select v-model="horaInicio" @change="guardado = false">
              <option v-for="h in OPCIONES.slice(0, -1)" :key="h" :value="h">{{ h }}</option>
            </select>
          </label>
          <label>Hasta
            <select v-model="horaFin" @change="guardado = false">
              <option v-for="h in OPCIONES.slice(1)" :key="h" :value="h">{{ h }}</option>
            </select>
          </label>
          <button class="btn" type="submit" :disabled="guardando || !horarioValido">
            {{ guardando ? 'Guardando...' : 'Guardar horario' }}
          </button>
        </div>
        <p v-if="!horarioValido" class="error" role="alert">La hora de inicio debe ser anterior a la de fin.</p>
        <p v-else class="hint">{{ turnosPorDia }} turnos por día.</p>
        <p v-if="errorHorario" class="error" role="alert">{{ errorHorario }}</p>
        <p v-if="guardado" class="ok" role="status">Horario guardado.</p>
      </form>
    </article>
  </section>
</template>

<style scoped>
.card { max-width: 600px; margin-top: var(--space-3); padding: var(--space-4); border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); }
dl { display: grid; gap: var(--space-2); }
dt { font-weight: 700; }
dd { margin: 0; }
.error { color: var(--color-danger); }
.account-actions { display: grid; gap: var(--space-2); margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--color-border); }
.account-actions h2 { margin: 0; font-size: 1.05rem; }
.note { margin: var(--space-2) 0 0; padding: 10px 12px; border-radius: 10px; background: #f3f6f5; color: var(--color-muted, #5d6b66); font-size: 0.88rem; }
.row input { font: inherit; padding: 8px 10px; }
.schedule { display: grid; gap: var(--space-2); margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--color-border); }
.schedule h2 { margin: 0; font-size: 1.05rem; }
.row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--space-3); }
.row label { display: grid; gap: 4px; font-weight: 600; }
.row select { font: inherit; padding: 8px 10px; min-width: 110px; }
.hint { margin: 0; color: var(--color-muted, #5d6b66); font-size: 0.85rem; }
.ok { margin: 0; color: var(--color-brand, #0d6657); font-weight: 600; }
</style>
