<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { storeToRefs } from 'pinia';
import BaseCard from '../../components/ui/BaseCard.vue';
import NoticeBanner from '../../components/ui/NoticeBanner.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import StatusChip, { type ChipTone } from '../../components/ui/StatusChip.vue';
import { TRIAGE_LABELS, type TriageLevel } from '../../services/triage';
import { messageFrom } from '../../shared/errors';
import { minutesSince } from '../../shared/format';
import { useTriageStore } from '../../stores/triage.store';
import { useSessionStore } from '../iam/session.store';

const session = useSessionStore();
const store = useTriageStore();
const { queue, loading, error, redCount } = storeToRefs(store);

const canRegister = computed(() => session.role === 'ENFERMERO');
const levels = Object.keys(TRIAGE_LABELS) as TriageLevel[];
const TONES: Record<TriageLevel, ChipTone> = { ROJO: 'danger', AMARILLO: 'warning', VERDE: 'success' };

const form = reactive<{ paciente: string; motivo: string; nivel: TriageLevel }>({ paciente: '', motivo: '', nivel: 'AMARILLO' });
const submitted = ref(false);
const saving = ref(false);
const aviso = ref<string | null>(null);
const fallo = ref<string | null>(null);

async function register(): Promise<void> {
  submitted.value = true;
  aviso.value = null;
  fallo.value = null;
  if (!form.paciente.trim() || !form.motivo.trim()) return;
  saving.value = true;
  try {
    const saved = await store.register({ paciente: form.paciente.trim(), motivo: form.motivo.trim(), nivel: form.nivel });
    aviso.value =
      saved.nivel === 'ROJO'
        ? `${saved.paciente} pasa primero en la cola. Se alertó a los médicos de guardia.`
        : `${saved.paciente} quedó en la cola de espera.`;
    Object.assign(form, { paciente: '', motivo: '', nivel: 'AMARILLO' });
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
  <div class="page">
    <PageHeader title="Triaje de guardia" subtitle="Clasificá a los pacientes que llegan sin turno: el riesgo vital pasa primero." />

    <NoticeBanner v-if="redCount > 0" tone="error" title="Código Rojo en la cola">
      {{ redCount }} paciente{{ redCount === 1 ? '' : 's' }} con riesgo vital. Los médicos de guardia fueron alertados.
    </NoticeBanner>
    <NoticeBanner v-if="aviso" tone="success">{{ aviso }}</NoticeBanner>
    <NoticeBanner v-if="fallo" tone="error">{{ fallo }}</NoticeBanner>

    <div class="grid-eq">
      <BaseCard v-if="canRegister">
        <template #header><h3>Registrar ingreso</h3></template>
        <form novalidate @submit.prevent="register">
          <div class="form-grid">
            <label class="full">
              Paciente
              <input v-model="form.paciente" maxlength="80" autocomplete="off" />
              <span v-if="submitted && !form.paciente.trim()" class="field-error">Ingresá el nombre del paciente.</span>
            </label>
            <label class="full">
              Motivo de consulta
              <input v-model="form.motivo" maxlength="120" autocomplete="off" />
              <span v-if="submitted && !form.motivo.trim()" class="field-error">Ingresá el motivo.</span>
            </label>
            <label class="full">
              Nivel de urgencia
              <select v-model="form.nivel">
                <option v-for="l in levels" :key="l" :value="l">{{ TRIAGE_LABELS[l] }}</option>
              </select>
            </label>
          </div>
          <div class="form-actions">
            <button class="btn" type="submit" :disabled="saving">{{ saving ? 'Guardando...' : 'Clasificar e ingresar a la cola' }}</button>
          </div>
        </form>
      </BaseCard>

      <BaseCard :class="{ wide: !canRegister }">
        <template #header><h3>Cola de espera</h3></template>
        <NoticeBanner v-if="error" tone="error">
          {{ error }} <button type="button" class="btn-sm" @click="store.load">Reintentar</button>
        </NoticeBanner>
        <p v-else-if="loading && queue.length === 0" role="status">Cargando cola...</p>
        <p v-else-if="queue.length === 0" class="muted">No hay pacientes en espera.</p>
        <ol v-else class="queue">
          <li v-for="(entry, i) in queue" :key="entry.id" :class="{ 'critical-row': entry.nivel === 'ROJO' }">
            <span class="pos">{{ i + 1 }}</span>
            <div class="who">
              <strong>{{ entry.paciente }}</strong>
              <small>{{ entry.motivo }} · espera {{ minutesSince(entry.llegadaAt) }} min</small>
            </div>
            <StatusChip :label="TRIAGE_LABELS[entry.nivel]" :tone="TONES[entry.nivel]" />
          </li>
        </ol>
      </BaseCard>
    </div>
  </div>
</template>

<style scoped>
.queue { list-style: none; margin: 0; padding: 0; }
.queue li { display: flex; align-items: center; gap: 12px; padding: 12px 8px; border-bottom: 1px solid var(--color-line); }
.queue li:last-child { border-bottom: 0; }
.pos { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; background: var(--color-brand-soft); color: var(--color-brand); font-weight: 700; font-size: 0.78rem; flex-shrink: 0; }
.who { display: grid; flex: 1; min-width: 0; }
.who small { color: var(--color-muted); }
.wide { grid-column: 1 / -1; }
</style>
