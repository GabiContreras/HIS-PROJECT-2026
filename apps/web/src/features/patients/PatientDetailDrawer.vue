<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppIcon from '../../components/ui/AppIcon.vue';
import SideDrawer from '../../components/ui/SideDrawer.vue';
import StatusChip from '../../components/ui/StatusChip.vue';
import { usePatients } from '../../composables/usePatients';
import type { Patient } from '../../services/patients';
import { formatDocument } from '../../shared/format';
import CoverageFields from './CoverageFields.vue';
import { coberturaTexto, COBERTURA_CORTA, validarCobertura, type CoberturaForm } from './coverage-ui';

const props = defineProps<{ open: boolean; patient: Patient | null; canEdit: boolean }>();
const emit = defineEmits<{ close: []; updated: [patient: Patient] }>();

const { saving, saveError, updateCoverage } = usePatients();
const editing = ref(false);
const submitted = ref(false);
const cobertura = ref<CoberturaForm>({ tipo: '', entidad: '' });
const coverageErrors = computed(() => validarCobertura(cobertura.value));

function startEditing(): void {
  if (!props.patient) return;
  cobertura.value = { tipo: props.patient.tipoCobertura, entidad: props.patient.entidadCobertura ?? '' };
  submitted.value = false;
  saveError.value = null;
  editing.value = true;
}

watch(() => [props.open, props.patient?.id], () => (editing.value = false));

async function save(): Promise<void> {
  submitted.value = true;
  if (!props.patient || Object.keys(coverageErrors.value).length > 0) return;
  const entidad = cobertura.value.entidad.trim();
  const tipo = cobertura.value.tipo as Exclude<CoberturaForm['tipo'], ''>;
  const updated = await updateCoverage(props.patient.id, {
    tipoCobertura: tipo,
    ...(entidad && tipo !== 'PARTICULAR' ? { entidadCobertura: entidad } : {}),
  });
  if (updated) {
    editing.value = false;
    emit('updated', updated);
  }
}

function age(birth: string): number {
  const b = new Date(`${birth.slice(0, 10)}T00:00:00`);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) years -= 1;
  return years;
}

const birthLabel = (birth: string): string =>
  new Date(`${birth.slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const initials = computed(() =>
  props.patient ? `${props.patient.nombre[0] ?? ''}${props.patient.apellido[0] ?? ''}`.toUpperCase() : '',
);
</script>

<template>
  <SideDrawer
    :open="open"
    title="Detalle del paciente"
    :subtitle="patient ? `${patient.nombre} ${patient.apellido} · DNI ${formatDocument(patient.documento)}` : undefined"
    @close="emit('close')"
  >
    <template #icon><AppIcon name="check" :size="22" /></template>

    <div v-if="patient" class="detail">
      <section class="summary">
        <span class="avatar">{{ initials }}</span>
        <div>
          <strong>{{ patient.nombre }} {{ patient.apellido }}</strong>
          <span>DNI {{ formatDocument(patient.documento) }}</span>
          <span><AppIcon name="calendar" :size="14" /> Nacimiento: {{ birthLabel(patient.fechaNacimiento) }}</span>
        </div>
      </section>

      <section class="block">
        <h3>Datos personales</h3>
        <dl class="grid">
          <div><dt>Nombre</dt><dd>{{ patient.nombre }}</dd></div>
          <div><dt>Apellido</dt><dd>{{ patient.apellido }}</dd></div>
          <div><dt>Documento (DNI)</dt><dd>{{ formatDocument(patient.documento) }}</dd></div>
          <div><dt>Fecha de nacimiento</dt><dd>{{ birthLabel(patient.fechaNacimiento) }}</dd></div>
          <div><dt>Edad</dt><dd>{{ age(patient.fechaNacimiento) }} años</dd></div>
          <div><dt>Teléfono</dt><dd :class="{ quiet: !patient.telefono }">{{ patient.telefono || 'No informado' }}</dd></div>
        </dl>
      </section>

      <section class="block">
        <div class="block-head">
          <h3>Cobertura</h3>
          <button v-if="canEdit && !editing" class="btn btn-sm btn-secondary" type="button" @click="startEditing">Cambiar</button>
        </div>

        <template v-if="!editing">
          <div class="coverage-card">
            <StatusChip
              :label="COBERTURA_CORTA[patient.tipoCobertura]"
              :tone="patient.tipoCobertura === 'PARTICULAR' ? 'neutral' : patient.tipoCobertura === 'MEDICINA_PREPAGA' ? 'violet' : 'success'"
            />
            <strong>{{ coberturaTexto(patient) }}</strong>
          </div>
          <p class="hint">Se usa para calcular cuánto abona el paciente al facturar cada atención.</p>
        </template>

        <form v-else class="edit" novalidate @submit.prevent="save">
          <CoverageFields v-model="cobertura" :errors="submitted ? coverageErrors : undefined" :disabled="saving" />
          <p class="hint">El cambio vale para las próximas atenciones; los cargos ya emitidos no se modifican.</p>
          <p v-if="saveError" class="field-error" role="alert">{{ saveError }}</p>
          <div class="actions">
            <button class="btn btn-secondary" type="button" :disabled="saving" @click="editing = false">Cancelar</button>
            <button class="btn" type="submit" :disabled="saving">{{ saving ? 'Guardando...' : 'Guardar cobertura' }}</button>
          </div>
        </form>
      </section>
    </div>

    <template #footer>
      <button class="btn btn-secondary" type="button" @click="emit('close')">Cerrar detalle</button>
    </template>
  </SideDrawer>
</template>

<style scoped>
.detail { display: grid; gap: 24px; }
.summary { display: flex; align-items: center; gap: 14px; padding: 16px; border: 1px solid #b7d9d1; border-radius: 14px; background: var(--color-brand-soft); }
.summary div { display: grid; gap: 2px; line-height: 1.35; }
.summary strong { font-size: 1.05rem; }
.summary span:not(.avatar) { display: inline-flex; align-items: center; gap: 6px; color: var(--color-muted); font-size: 0.82rem; }
.avatar { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; background: #fff; color: var(--color-brand-dark); font-weight: 700; flex: none; }
.block { display: grid; gap: 10px; }
.block h3 { margin: 0; font-family: var(--font); font-size: 0.8rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-brand-dark); }
.block-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin: 0; }
.grid div { display: grid; gap: 2px; min-width: 0; }
dt { color: var(--color-muted); font-size: 0.78rem; }
dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
.quiet { color: #8a9692; font-weight: 500; }
.coverage-card { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 14px; border: 1px solid var(--color-line); border-radius: 12px; }
.hint { margin: 0; }
.edit { display: grid; gap: 12px; }
.actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
