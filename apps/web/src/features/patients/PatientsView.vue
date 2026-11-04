<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import BaseCard from '../../components/ui/BaseCard.vue';
import AppIcon from '../../components/ui/AppIcon.vue';
import NoticeBanner from '../../components/ui/NoticeBanner.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import StatusChip from '../../components/ui/StatusChip.vue';
import { usePatients } from '../../composables/usePatients';
import type { Patient } from '../../services/patients';
import { formatDocument } from '../../shared/format';
import { useSessionStore } from '../iam/session.store';
import { coberturaTexto, COBERTURA_CORTA } from './coverage-ui';
import NewPatientDrawer from './NewPatientDrawer.vue';
import PatientDetailDrawer from './PatientDetailDrawer.vue';

const route = useRoute();
const session = useSessionStore();
const { patients, loading, error, load } = usePatients();

const canCreate = computed(() => session.role === 'ADMINISTRATIVO');
const query = ref(String(route.query.q ?? ''));
const newOpen = ref(canCreate.value && route.query.nuevo === '1');
const detailOpen = ref(false);
const selected = ref<Patient | null>(null);
const notice = ref<string | null>(null);

function age(birth: string): number {
  const b = new Date(`${birth.slice(0, 10)}T00:00:00`);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) years -= 1;
  return years;
}

function open(patient: Patient): void {
  newOpen.value = false;
  selected.value = patient;
  detailOpen.value = true;
}

function openNew(): void {
  detailOpen.value = false;
  notice.value = null;
  newOpen.value = true;
}

async function onSaved(patient: Patient): Promise<void> {
  newOpen.value = false;
  notice.value = `${patient.apellido}, ${patient.nombre} (DNI ${formatDocument(patient.documento)}) se registró correctamente.`;
  query.value = '';
  await load('');
}

function onUpdated(patient: Patient): void {
  selected.value = patient;
  patients.value = patients.value.map((p) => (p.id === patient.id ? patient : p));
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
    <PageHeader title="Pacientes" subtitle="Registrá nuevos pacientes y consultá la información de los existentes.">
      <input v-model="query" class="search" type="search" placeholder="Buscar paciente..." aria-label="Buscar paciente" />
    </PageHeader>

    <NoticeBanner v-if="notice" tone="success" title="Registro exitoso">{{ notice }}</NoticeBanner>

    <BaseCard>
      <template #header>
        <div class="list-head">
          <div>
            <h3>Listado</h3>
            <p class="muted">{{ patients.length }} {{ patients.length === 1 ? 'paciente' : 'pacientes' }}{{ query ? ' encontrados' : ' registrados' }}</p>
          </div>
          <button v-if="canCreate" class="btn" type="button" @click="openNew">Nuevo paciente</button>
        </div>
      </template>

      <NoticeBanner v-if="error" tone="error">
        {{ error }} <button type="button" class="btn-sm" :disabled="loading" @click="load(query)">Reintentar</button>
      </NoticeBanner>
      <p v-else-if="loading && patients.length === 0" role="status">Cargando pacientes...</p>
      <p v-else-if="patients.length === 0" class="muted">No se encontraron pacientes.</p>
      <div v-else class="scroll-x">
        <table class="rows">
          <thead>
            <tr><th>Paciente</th><th>Documento</th><th>Edad</th><th>Teléfono</th><th>Cobertura</th><th></th></tr>
          </thead>
          <tbody>
            <tr
              v-for="p in patients"
              :key="p.id"
              tabindex="0"
              :aria-label="`Ver detalle de ${p.nombre} ${p.apellido}`"
              @click="open(p)"
              @keydown.enter.prevent="open(p)"
              @keydown.space.prevent="open(p)"
            >
              <td><strong>{{ p.apellido }}</strong>, {{ p.nombre }}</td>
              <td>{{ formatDocument(p.documento) }}</td>
              <td>{{ age(p.fechaNacimiento) }} años</td>
              <td>{{ p.telefono ?? '—' }}</td>
              <td>
                <StatusChip
                  :label="COBERTURA_CORTA[p.tipoCobertura]"
                  :title="coberturaTexto(p)"
                  :tone="p.tipoCobertura === 'PARTICULAR' ? 'neutral' : p.tipoCobertura === 'MEDICINA_PREPAGA' ? 'violet' : 'success'"
                />
              </td>
              <td class="go"><AppIcon name="chevron-right" :size="16" /></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="patients.length >= 50" class="hint">Se muestran los primeros 50 resultados. Afiná la búsqueda para ver otros.</p>
    </BaseCard>

    <PatientDetailDrawer :open="detailOpen" :patient="selected" :can-edit="canCreate" @close="detailOpen = false" @updated="onUpdated" />
    <NewPatientDrawer v-if="canCreate" :open="newOpen" @close="newOpen = false" @saved="onSaved" />
  </div>
</template>

<style scoped>
.search { width: 260px; }
.list-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; }
.list-head h3, .list-head p { margin: 0; }
.rows tbody tr { cursor: pointer; }
.rows tbody tr:hover, .rows tbody tr:focus-visible { background: var(--color-brand-soft); outline: none; }
.go { width: 32px; color: var(--color-muted); }
</style>
