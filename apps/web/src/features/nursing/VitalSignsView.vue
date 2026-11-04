<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { storeToRefs } from 'pinia';
import PatientPicker from '../../components/PatientPicker.vue';
import BaseCard from '../../components/ui/BaseCard.vue';
import NoticeBanner from '../../components/ui/NoticeBanner.vue';
import StatusChip from '../../components/ui/StatusChip.vue';
import type { Patient } from '../../services/patients';
import { CRITICAL_TEMPERATURE, validateInput } from '../../services/vitalSigns';
import { messageFrom } from '../../shared/errors';
import { formatDateTime } from '../../shared/format';
import { useVitalsStore } from '../../stores/vitals.store';
import { useSessionStore } from '../iam/session.store';

const session = useSessionStore();
const store = useVitalsStore();
const { records, loading, error } = storeToRefs(store);

const canRecord = computed(() => session.role === 'ENFERMERO');
const paciente = ref<Patient | null>(null);
const form = reactive({ sistolica: '', diastolica: '', frecuenciaCardiaca: '', temperatura: '' });
const saving = ref(false);
const submitted = ref(false);
const aviso = ref<{ tone: 'success' | 'error'; title: string; text: string } | null>(null);
const fallo = ref<string | null>(null);

const input = computed(() => ({
  pacienteId: paciente.value?.id ?? '',
  paciente: paciente.value ? `${paciente.value.nombre} ${paciente.value.apellido}` : '',
  sistolica: Number(form.sistolica),
  diastolica: Number(form.diastolica),
  frecuenciaCardiaca: Number(form.frecuenciaCardiaca),
  temperatura: Number(form.temperatura),
}));
const problems = computed(() => validateInput(input.value));
const hot = computed(() => Number(form.temperatura) > CRITICAL_TEMPERATURE);

async function save(): Promise<void> {
  submitted.value = true;
  fallo.value = null;
  aviso.value = null;
  if (!paciente.value || problems.value.length > 0) return;
  saving.value = true;
  try {
    const saved = await store.record(input.value);
    aviso.value = saved.critico
      ? { tone: 'error', title: 'Registro crítico', text: `${saved.temperatura} °C supera los ${CRITICAL_TEMPERATURE} °C. Se notificó al médico de guardia.` }
      : { tone: 'success', title: 'Registro guardado', text: saved.nota };
    Object.assign(form, { sistolica: '', diastolica: '', frecuenciaCardiaca: '', temperatura: '' });
    submitted.value = false;
  } catch (reason) {
    fallo.value = messageFrom(reason);
  } finally {
    saving.value = false;
  }
}

onMounted(store.load);
</script>

<template>
  <div class="layout" :class="{ single: !canRecord }">
    <BaseCard v-if="canRecord">
      <template #header><h3>Registrar signos vitales</h3></template>
      <form novalidate @submit.prevent="save">
        <div class="form-grid">
          <div class="full"><PatientPicker v-model="paciente" label="Paciente internado" /></div>
          <label>Sistólica (mmHg)<input v-model="form.sistolica" type="number" inputmode="numeric" /></label>
          <label>Diastólica (mmHg)<input v-model="form.diastolica" type="number" inputmode="numeric" /></label>
          <label>Frecuencia cardíaca (lpm)<input v-model="form.frecuenciaCardiaca" type="number" inputmode="numeric" /></label>
          <label>
            Temperatura (°C)
            <input v-model="form.temperatura" type="number" step="0.1" :class="{ hot }" />
            <span v-if="hot" class="field-error">Supera {{ CRITICAL_TEMPERATURE }} °C: se avisará al médico de guardia.</span>
          </label>
          <div v-if="submitted" class="full errors" role="alert">
            <p v-if="!paciente" class="field-error">Elegí un paciente.</p>
            <p v-for="p in problems" :key="p" class="field-error">{{ p }}</p>
          </div>
          <p v-if="fallo" class="full field-error" role="alert">{{ fallo }}</p>
        </div>
        <div class="form-actions">
          <button class="btn" type="submit" :disabled="saving">{{ saving ? 'Guardando...' : 'Guardar registro' }}</button>
        </div>
      </form>
    </BaseCard>

    <div class="stack">
      <NoticeBanner v-if="aviso" :tone="aviso.tone" :title="aviso.title">{{ aviso.text }}</NoticeBanner>
      <NoticeBanner v-if="!canRecord" tone="info">Solo enfermería registra signos vitales. Vos podés consultarlos.</NoticeBanner>

      <BaseCard>
        <template #header><h3>Últimos registros</h3></template>
        <NoticeBanner v-if="error" tone="error">
          {{ error }} <button type="button" class="btn-sm" @click="store.load">Reintentar</button>
        </NoticeBanner>
        <p v-else-if="loading && records.length === 0" role="status">Cargando registros...</p>
        <p v-else-if="records.length === 0" class="muted">Todavía no hay registros.</p>
        <div v-else class="scroll-x">
          <table>
            <thead><tr><th>Paciente</th><th>PA</th><th>FC</th><th>Temp.</th><th>Fecha</th><th></th></tr></thead>
            <tbody>
              <tr v-for="r in records" :key="r.id" :class="{ 'critical-row': r.critico }">
                <td>{{ r.paciente }}<br /><small class="muted">{{ r.nota }}</small></td>
                <td>{{ r.sistolica }}/{{ r.diastolica }}</td>
                <td>{{ r.frecuenciaCardiaca }}</td>
                <td :class="{ red: r.critico }"><strong>{{ r.temperatura }} °C</strong></td>
                <td>{{ formatDateTime(r.fechaHora) }}<br /><small class="muted">{{ r.registradoPor }}</small></td>
                <td><StatusChip v-if="r.critico" label="Crítico" tone="danger" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </BaseCard>
    </div>
  </div>
</template>

<style scoped>
.layout { display: grid; grid-template-columns: 1fr 1.6fr; gap: 20px; align-items: start; }
.layout.single { grid-template-columns: 1fr; }
.layout > * { min-width: 0; }
.stack { display: grid; gap: 16px; }
.errors { display: grid; gap: 4px; }
.hot { border-color: var(--color-danger); background: var(--color-danger-soft); }
.red { color: var(--color-danger); }
@media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
</style>
