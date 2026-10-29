<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import { useClinicalHistory } from '@/composables/useClinicalHistory';
import { usePatients } from '@/composables/usePatients';
import { useSessionStore } from '@/features/iam/session.store';
import { ApiError } from '@/shared/http';
import { CLINICAL_SECTIONS, type ClinicalSection, type ClinicalSectionKey } from '@/services/clinicalHistory';

const session = useSessionStore();
const { patients, error: patientsError, load: loadPatients } = usePatients();
const { history, loading, error, load, add, clear } = useClinicalHistory();

const selectedPatient = ref('');
const canWrite = computed(() => session.role === 'MEDICO');

const forms = reactive<Record<ClinicalSectionKey, { titulo: string; detalle: string; saving: boolean; error: string | null }>>({
  alergias: { titulo: '', detalle: '', saving: false, error: null },
  antecedentesFamiliares: { titulo: '', detalle: '', saving: false, error: null },
  evoluciones: { titulo: '', detalle: '', saving: false, error: null },
  estudios: { titulo: '', detalle: '', saving: false, error: null },
});

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

function canSave(section: ClinicalSection): boolean {
  const form = forms[section.key];
  const hasTitle = section.titleField === null || form.titulo.trim().length >= 2;
  return hasTitle && form.detalle.trim().length >= 2 && !form.saving;
}

function reload(): void {
  if (selectedPatient.value !== '') void load(selectedPatient.value);
}

async function save(section: ClinicalSection): Promise<void> {
  const form = forms[section.key];
  if (!canSave(section)) return;
  form.saving = true;
  form.error = null;
  try {
    await add(selectedPatient.value, section, form.titulo.trim(), form.detalle.trim());
    form.titulo = '';
    form.detalle = '';
  } catch (e) {
    form.error = e instanceof ApiError ? e.message : 'No se pudo guardar el registro.';
  } finally {
    form.saving = false;
  }
}

watch(selectedPatient, (id) => {
  if (id === '') clear();
  else void load(id);
});

onMounted(loadPatients);
</script>

<template>
  <section class="stack">
    <h1>Historia clínica</h1>
    <BaseCard>
      <template #header><h3>Paciente</h3></template>
      <p v-if="patientsError" class="error" role="alert">
        {{ patientsError }} <button type="button" @click="loadPatients">Reintentar</button>
      </p>
      <label>
        Paciente
        <select v-model="selectedPatient">
          <option value="">Seleccioná un paciente</option>
          <option v-for="p in patients" :key="p.id" :value="p.id">
            {{ p.apellido }}, {{ p.nombre }} ({{ p.documento }})
          </option>
        </select>
      </label>
    </BaseCard>

    <p v-if="selectedPatient === ''" class="muted">Elegí un paciente para ver su historia clínica.</p>
    <p v-else-if="error" class="error" role="alert">
      {{ error }} <button type="button" :disabled="loading" @click="reload">Reintentar</button>
    </p>
    <p v-else-if="loading && history === null" role="status">Cargando historia clínica...</p>

    <template v-else-if="history">
      <BaseCard>
        <template #header><h3>Ficha del paciente</h3></template>
        <dl class="ficha">
          <div><dt>Apellido y nombre</dt><dd>{{ history.paciente.apellido }}, {{ history.paciente.nombre }}</dd></div>
          <div><dt>Documento</dt><dd>{{ history.paciente.documento }}</dd></div>
          <div><dt>Fecha de nacimiento</dt><dd>{{ history.paciente.fechaNacimiento }}</dd></div>
          <div><dt>Teléfono</dt><dd>{{ history.paciente.telefono ?? '—' }}</dd></div>
        </dl>
      </BaseCard>

      <BaseCard v-for="section in CLINICAL_SECTIONS" :key="section.key">
        <template #header><h3>{{ section.title }}</h3></template>
        <p v-if="history[section.key].length === 0" class="muted">{{ section.empty }}</p>
        <ul v-else class="records">
          <li v-for="record in history[section.key]" :key="record.id">
            <strong v-if="record.titulo">{{ record.titulo }}</strong>
            <p>{{ record.detalle }}</p>
            <small class="muted">{{ record.registradoPor }} · {{ formatDate(record.fechaHora) }}</small>
          </li>
        </ul>

        <form v-if="canWrite" novalidate @submit.prevent="save(section)">
          <label v-if="section.titleField">
            {{ section.titleLabel }}
            <input v-model="forms[section.key].titulo" type="text" maxlength="120" />
          </label>
          <label>
            {{ section.detailLabel }}
            <textarea v-model="forms[section.key].detalle" rows="3"></textarea>
          </label>
          <p v-if="forms[section.key].error" class="error" role="alert">{{ forms[section.key].error }}</p>
          <button type="submit" :disabled="!canSave(section)">
            {{ forms[section.key].saving ? 'Guardando...' : 'Agregar' }}
          </button>
          <small class="muted">Los registros no se pueden modificar ni eliminar.</small>
        </form>
      </BaseCard>
    </template>
  </section>
</template>

<style scoped>
h1 { margin-top: 0; }
h3 { margin: 0; }
.stack { display: grid; gap: var(--space-4); max-width: 900px; }
label { display: grid; gap: var(--space-1); font-size: 0.9rem; }
select, input, textarea { font: inherit; padding: 8px; border: 1px solid var(--color-border); border-radius: 8px; }
form { display: grid; gap: var(--space-3); margin-top: var(--space-3); }
button[type='submit'] { font: inherit; padding: 10px; border: 0; border-radius: 8px; cursor: pointer;
  background: var(--color-primary); color: #fff; font-weight: 600; }
button[type='submit']:disabled { opacity: 0.5; cursor: not-allowed; }
.muted { color: var(--color-muted); margin: 0; }
.error { color: var(--color-danger); margin: 0; }
.ficha { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-3); margin: 0; }
.ficha dt { color: var(--color-muted); font-size: 0.8rem; }
.ficha dd { margin: 0; font-weight: 600; }
.records { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
.records li { border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-2); }
.records p { margin: var(--space-1) 0; white-space: pre-wrap; }

@media (max-width: 900px) {
  .ficha { grid-template-columns: 1fr; }
}
</style>
