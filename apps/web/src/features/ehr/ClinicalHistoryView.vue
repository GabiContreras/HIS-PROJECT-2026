<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import PatientPicker from '../../components/PatientPicker.vue';
import BaseCard from '../../components/ui/BaseCard.vue';
import NoticeBanner from '../../components/ui/NoticeBanner.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import { useClinicalHistory } from '../../composables/useClinicalHistory';
import { CLINICAL_SECTIONS, type ClinicalSection, type ClinicalSectionKey } from '../../services/clinicalHistory';
import type { Patient } from '../../services/patients';
import { messageFrom } from '../../shared/errors';
import { displayName, formatDate, formatDateTime } from '../../shared/format';
import { useSessionStore } from '../iam/session.store';

const session = useSessionStore();
const { history, loading, error, load, add, clear } = useClinicalHistory();

const paciente = ref<Patient | null>(null);
const canWrite = computed(() => session.role === 'MEDICO');

const forms = reactive<Record<ClinicalSectionKey, { titulo: string; detalle: string; saving: boolean; touched: boolean; error: string | null; aviso: string | null }>>({
  alergias: { titulo: '', detalle: '', saving: false, touched: false, error: null, aviso: null },
  antecedentesFamiliares: { titulo: '', detalle: '', saving: false, touched: false, error: null, aviso: null },
  evoluciones: { titulo: '', detalle: '', saving: false, touched: false, error: null, aviso: null },
  estudios: { titulo: '', detalle: '', saving: false, touched: false, error: null, aviso: null },
});

function canSave(section: ClinicalSection): boolean {
  const form = forms[section.key];
  const hasTitle = section.titleField === null || form.titulo.trim().length >= 2;
  return hasTitle && form.detalle.trim().length >= 2 && !form.saving;
}

function showHint(section: ClinicalSection): boolean {
  const form = forms[section.key];
  return form.touched && !form.aviso && !form.saving && !canSave(section);
}

function onInput(section: ClinicalSection): void {
  forms[section.key].aviso = null;
  forms[section.key].touched = true;
}

function reload(): void {
  if (paciente.value) void load(paciente.value.id);
}

async function save(section: ClinicalSection): Promise<void> {
  const form = forms[section.key];
  if (!paciente.value || !canSave(section)) return;
  form.saving = true;
  form.error = null;
  form.aviso = null;
  try {
    await add(paciente.value.id, section, form.titulo.trim(), form.detalle.trim());
    form.titulo = '';
    form.detalle = '';
    form.touched = false;
    form.aviso = `Registro agregado a «${section.title}».`;
  } catch (reason) {
    form.error = messageFrom(reason, 'No se pudo guardar el registro.');
  } finally {
    form.saving = false;
  }
}

watch(paciente, (patient) => {
  for (const form of Object.values(forms)) form.aviso = null;
  if (patient) void load(patient.id);
  else clear();
});
</script>

<template>
  <div class="page">
    <PageHeader
      title="Historia clínica"
      subtitle="Ficha, alergias, antecedentes, evoluciones y estudios. Los registros no se pueden modificar ni eliminar."
    />

    <BaseCard>
      <template #header><h3>Paciente</h3></template>
      <PatientPicker v-model="paciente" label="Paciente" />
    </BaseCard>

    <p v-if="!paciente" class="muted">Elegí un paciente para ver su historia clínica.</p>
    <NoticeBanner v-else-if="error" tone="error">
      {{ error }} <button type="button" class="btn-sm" :disabled="loading" @click="reload">Reintentar</button>
    </NoticeBanner>
    <p v-else-if="loading && history === null" role="status">Cargando historia clínica...</p>

    <template v-else-if="history">
      <BaseCard>
        <template #header><h3>Ficha del paciente</h3></template>
        <dl class="ficha">
          <div><dt>Nombre y apellido</dt><dd>{{ history.paciente.nombre }} {{ history.paciente.apellido }}</dd></div>
          <div><dt>Documento</dt><dd>{{ history.paciente.documento }}</dd></div>
          <div><dt>Fecha de nacimiento</dt><dd>{{ formatDate(history.paciente.fechaNacimiento) }}</dd></div>
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
            <small class="muted">{{ displayName(record.registradoPor) }} · {{ formatDateTime(record.fechaHora) }}</small>
          </li>
        </ul>

        <NoticeBanner v-if="forms[section.key].aviso" tone="success">{{ forms[section.key].aviso }}</NoticeBanner>

        <form v-if="canWrite" class="form-grid" novalidate @submit.prevent="save(section)">
          <label v-if="section.titleField" class="full">
            {{ section.titleLabel }}
            <input v-model="forms[section.key].titulo" type="text" maxlength="120" @input="onInput(section)" />
          </label>
          <label class="full">
            {{ section.detailLabel }}
            <textarea v-model="forms[section.key].detalle" rows="3" @input="onInput(section)"></textarea>
          </label>
          <p v-if="forms[section.key].error" class="full field-error" role="alert">{{ forms[section.key].error }}</p>
          <small v-if="showHint(section)" class="full muted">Completá los campos obligatorios (mínimo 2 caracteres) para agregar.</small>
          <div class="full form-actions">
            <button class="btn" type="submit" :disabled="!canSave(section)">
              {{ forms[section.key].saving ? 'Guardando...' : 'Agregar' }}
            </button>
          </div>
        </form>
      </BaseCard>
    </template>
  </div>
</template>

<style scoped>
.ficha { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 0; }
.ficha dt { color: var(--color-muted); font-size: 0.8rem; }
.ficha dd { margin: 0; font-weight: 600; }
.records { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 12px; }
.records li { border-bottom: 1px solid var(--color-line); padding-bottom: 8px; }
.records p { margin: 4px 0; white-space: pre-wrap; }

@media (max-width: 900px) {
  .ficha { grid-template-columns: 1fr; }
}
</style>
