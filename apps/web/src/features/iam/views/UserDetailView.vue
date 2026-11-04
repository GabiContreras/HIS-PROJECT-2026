<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import UserStatusChip from '../../../components/UserStatusChip.vue';
import { actualizarHorario } from '../../../services/users';
import { messageFrom } from '../../../shared/errors';
import { useUsers } from '../useUsers';

const route = useRoute();
const userId = computed(() => String(route.params.id));
const { usuario, cargando, error, cargarPorId } = useUsers();

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
      </dl>

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
.schedule { display: grid; gap: var(--space-2); margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--color-border); }
.schedule h2 { margin: 0; font-size: 1.05rem; }
.row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--space-3); }
.row label { display: grid; gap: 4px; font-weight: 600; }
.row select { font: inherit; padding: 8px 10px; min-width: 110px; }
.hint { margin: 0; color: var(--color-muted, #5d6b66); font-size: 0.85rem; }
.ok { margin: 0; color: var(--color-brand, #0d6657); font-weight: 600; }
</style>
