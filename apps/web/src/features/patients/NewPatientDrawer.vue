<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import AppIcon from '../../components/ui/AppIcon.vue';
import SideDrawer from '../../components/ui/SideDrawer.vue';
import { usePatients } from '../../composables/usePatients';
import type { Patient } from '../../services/patients';
import CoverageFields from './CoverageFields.vue';
import { validarCobertura, type CoberturaForm } from './coverage-ui';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; saved: [patient: Patient] }>();

const { saving, saveError, create } = usePatients();

const form = reactive({ nombre: '', apellido: '', documento: '', fechaNacimiento: '', telefono: '' });
const cobertura = ref<CoberturaForm>({ tipo: '', entidad: '' });
const submitted = ref(false);

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
const coverageErrors = computed(() => validarCobertura(cobertura.value));

function reset(): void {
  Object.assign(form, { nombre: '', apellido: '', documento: '', fechaNacimiento: '', telefono: '' });
  cobertura.value = { tipo: '', entidad: '' };
  submitted.value = false;
  saveError.value = null;
}

watch(() => props.open, (isOpen) => isOpen && reset());

async function submit(): Promise<void> {
  submitted.value = true;
  if (Object.keys(errors.value).length > 0 || Object.keys(coverageErrors.value).length > 0) return;
  const entidad = cobertura.value.entidad.trim();
  const saved = await create({
    nombre: form.nombre.trim(),
    apellido: form.apellido.trim(),
    documento: form.documento.trim(),
    fechaNacimiento: form.fechaNacimiento,
    ...(form.telefono.trim() ? { telefono: form.telefono.trim() } : {}),
    tipoCobertura: cobertura.value.tipo as Exclude<CoberturaForm['tipo'], ''>,
    ...(entidad && cobertura.value.tipo !== 'PARTICULAR' ? { entidadCobertura: entidad } : {}),
  });
  if (saved) emit('saved', saved);
}
</script>

<template>
  <SideDrawer :open="open" title="Nuevo paciente" subtitle="Completá los datos para crear un nuevo registro." @close="emit('close')">
    <template #icon><AppIcon name="plus" :size="22" /></template>

    <form id="new-patient-form" class="form" novalidate @submit.prevent="submit">
      <section class="group">
        <h3 class="heading">Datos personales</h3>
        <p class="hint">Los campos marcados con * son obligatorios.</p>
        <div class="fields">
          <label>
            <span>Nombre <b aria-hidden="true">*</b></span>
            <input v-model="form.nombre" maxlength="80" autocomplete="off" placeholder="Ingresá el nombre" />
            <span v-if="submitted && errors.nombre" class="field-error">{{ errors.nombre }}</span>
          </label>
          <label>
            <span>Apellido <b aria-hidden="true">*</b></span>
            <input v-model="form.apellido" maxlength="80" autocomplete="off" placeholder="Ingresá el apellido" />
            <span v-if="submitted && errors.apellido" class="field-error">{{ errors.apellido }}</span>
          </label>
          <label>
            <span>Documento (DNI) <b aria-hidden="true">*</b></span>
            <input v-model="form.documento" inputmode="numeric" maxlength="9" autocomplete="off" placeholder="Ej. 32567890" />
            <span v-if="submitted && errors.documento" class="field-error">{{ errors.documento }}</span>
          </label>
          <label>
            <span>Fecha de nacimiento <b aria-hidden="true">*</b></span>
            <input v-model="form.fechaNacimiento" type="date" :min="minBirth" :max="maxBirth" />
            <span v-if="submitted && errors.fechaNacimiento" class="field-error">{{ errors.fechaNacimiento }}</span>
          </label>
          <label>
            <span>Teléfono <span class="hint">(opcional)</span></span>
            <input v-model="form.telefono" type="tel" autocomplete="off" placeholder="Ej. 3564 000000" />
            <span v-if="submitted && errors.telefono" class="field-error">{{ errors.telefono }}</span>
          </label>
        </div>
      </section>

      <section class="group">
        <h3 class="heading">Cobertura <b aria-hidden="true">*</b></h3>
        <p class="hint">Define cómo se factura la atención del paciente. Se puede cambiar más adelante.</p>
        <CoverageFields v-model="cobertura" :errors="submitted ? coverageErrors : undefined" :disabled="saving" />
      </section>

      <p v-if="saveError" class="field-error" role="alert">{{ saveError }}</p>
    </form>

    <template #footer>
      <button class="btn btn-secondary" type="button" :disabled="saving" @click="emit('close')">Cancelar</button>
      <button class="btn" type="submit" form="new-patient-form" :disabled="saving">
        {{ saving ? 'Guardando...' : 'Registrar paciente' }}
      </button>
    </template>
  </SideDrawer>
</template>

<style scoped>
.form { display: grid; gap: 24px; }
.group { display: grid; gap: 10px; }
.heading { margin: 0; font-family: var(--font); font-size: 0.8rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-brand-dark); }
.group > .hint { margin: 0; }
.fields { display: grid; gap: 14px; }
.fields label { display: grid; gap: 6px; }
b { color: var(--color-danger, #b3261e); }
</style>
