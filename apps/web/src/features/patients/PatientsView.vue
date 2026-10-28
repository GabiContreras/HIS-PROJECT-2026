<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import BaseCard from '../../components/ui/BaseCard.vue';
import NoticeBanner from '../../components/ui/NoticeBanner.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import { usePatients } from '../../composables/usePatients';
import { useSessionStore } from '../iam/session.store';

const route = useRoute();
const session = useSessionStore();
const { patients, loading, error, saving, saveError, load, create } = usePatients();

const canCreate = computed(() => session.role === 'ADMINISTRATIVO');
const query = ref(String(route.query.q ?? ''));
const formVisible = ref(canCreate.value && route.query.nuevo === '1');
const created = ref<string | null>(null);
const submitted = ref(false);

const form = reactive({ nombre: '', apellido: '', documento: '', fechaNacimiento: '', telefono: '' });

const toDateInput = (d: Date) => d.toISOString().slice(0, 10);
const maxBirth = toDateInput(new Date());
const minBirth = toDateInput(new Date(new Date().getFullYear() - 120, 0, 1));

const errors = computed(() => {
  const result: Partial<Record<keyof typeof form, string>> = {};
  if (!form.nombre.trim()) result.nombre = 'Ingresá el nombre.';
  if (!form.apellido.trim()) result.apellido = 'Ingresá el apellido.';
  if (!/^\d{7,9}$/.test(form.documento.trim())) result.documento = 'El documento debe tener entre 7 y 9 dígitos.';
  if (!form.fechaNacimiento) result.fechaNacimiento = 'Ingresá la fecha de nacimiento.';
  else if (form.fechaNacimiento > maxBirth) result.fechaNacimiento = 'La fecha no puede ser futura.';
  else if (form.fechaNacimiento < minBirth) result.fechaNacimiento = 'Revisá la fecha: la edad no parece posible.';
  if (form.telefono.trim() && !/^[0-9+\-\s()]{6,20}$/.test(form.telefono.trim())) {
    result.telefono = 'Solo números, espacios, +, - y paréntesis (6 a 20 caracteres).';
  }
  return result;
});

function age(birth: string): number {
  const b = new Date(`${birth.slice(0, 10)}T00:00:00`);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) years -= 1;
  return years;
}

function reset(): void {
  Object.assign(form, { nombre: '', apellido: '', documento: '', fechaNacimiento: '', telefono: '' });
  submitted.value = false;
}

async function submit(): Promise<void> {
  submitted.value = true;
  created.value = null;
  if (Object.keys(errors.value).length > 0) return;
  const saved = await create({
    nombre: form.nombre.trim(),
    apellido: form.apellido.trim(),
    documento: form.documento.trim(),
    fechaNacimiento: form.fechaNacimiento,
    ...(form.telefono.trim() ? { telefono: form.telefono.trim() } : {}),
  });
  if (!saved) return;
  created.value = `${saved.apellido}, ${saved.nombre} (DNI ${saved.documento})`;
  reset();
  formVisible.value = false;
  await load(query.value);
}

let timer: ReturnType<typeof setTimeout> | undefined;
watch(query, (value) => {
  clearTimeout(timer);
  timer = setTimeout(() => load(value), 300);
});
watch(() => route.query.q, (q) => { query.value = String(q ?? ''); });
onBeforeUnmount(() => clearTimeout(timer));
onMounted(() => load(query.value));
</script>

<template>
  <div class="page">
    <PageHeader title="Pacientes" subtitle="Buscá por nombre, apellido o documento.">
      <input v-model="query" class="search" type="search" placeholder="Buscar paciente..." aria-label="Buscar paciente" />
      <button v-if="canCreate && !formVisible" class="btn" type="button" @click="formVisible = true">Nuevo paciente</button>
    </PageHeader>

    <NoticeBanner v-if="created" tone="success" title="Paciente registrado">{{ created }}</NoticeBanner>

    <BaseCard v-if="canCreate && formVisible">
      <template #header><h3>Registrar paciente</h3></template>
      <form novalidate @submit.prevent="submit">
        <div class="form-grid">
          <label>
            Nombre
            <input v-model="form.nombre" maxlength="80" autocomplete="off" />
            <span v-if="submitted && errors.nombre" class="field-error">{{ errors.nombre }}</span>
          </label>
          <label>
            Apellido
            <input v-model="form.apellido" maxlength="80" autocomplete="off" />
            <span v-if="submitted && errors.apellido" class="field-error">{{ errors.apellido }}</span>
          </label>
          <label>
            Documento (DNI)
            <input v-model="form.documento" inputmode="numeric" maxlength="9" autocomplete="off" />
            <span v-if="submitted && errors.documento" class="field-error">{{ errors.documento }}</span>
          </label>
          <label>
            Fecha de nacimiento
            <input v-model="form.fechaNacimiento" type="date" :min="minBirth" :max="maxBirth" />
            <span v-if="submitted && errors.fechaNacimiento" class="field-error">{{ errors.fechaNacimiento }}</span>
          </label>
          <label class="full">
            Teléfono <span class="hint">(opcional)</span>
            <input v-model="form.telefono" type="tel" autocomplete="off" />
            <span v-if="submitted && errors.telefono" class="field-error">{{ errors.telefono }}</span>
          </label>
          <p v-if="saveError" class="field-error full" role="alert">{{ saveError }}</p>
        </div>
        <div class="form-actions">
          <button class="btn btn-secondary" type="button" :disabled="saving" @click="formVisible = false; reset()">Cancelar</button>
          <button class="btn" type="submit" :disabled="saving">{{ saving ? 'Guardando...' : 'Registrar paciente' }}</button>
        </div>
      </form>
    </BaseCard>

    <BaseCard>
      <template #header><h3>Listado</h3></template>
      <NoticeBanner v-if="error" tone="error">
        {{ error }} <button type="button" class="btn-sm" :disabled="loading" @click="load(query)">Reintentar</button>
      </NoticeBanner>
      <p v-else-if="loading && patients.length === 0" role="status">Cargando pacientes...</p>
      <p v-else-if="patients.length === 0" class="muted">No se encontraron pacientes.</p>
      <div v-else class="scroll-x">
        <table>
          <thead><tr><th>Paciente</th><th>Documento</th><th>Edad</th><th>Teléfono</th></tr></thead>
          <tbody>
            <tr v-for="p in patients" :key="p.id">
              <td><strong>{{ p.apellido }}</strong>, {{ p.nombre }}</td>
              <td>{{ p.documento }}</td>
              <td>{{ age(p.fechaNacimiento) }} años</td>
              <td>{{ p.telefono ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="patients.length >= 50" class="hint">Se muestran los primeros 50 resultados. Afiná la búsqueda para ver otros.</p>
    </BaseCard>
  </div>
</template>

<style scoped>
.search { width: 260px; }
</style>
