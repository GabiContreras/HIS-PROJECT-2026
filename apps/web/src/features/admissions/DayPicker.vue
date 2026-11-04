<script setup lang="ts">
import { ref } from 'vue';
import AppIcon from '../../components/ui/AppIcon.vue';
import { longDateLabel } from './clinic-hours';

const props = defineProps<{
  /** Fecha elegida (AAAA-MM-DD). */
  modelValue: string;
  /** Primer día que se puede elegir (AAAA-MM-DD). */
  min?: string;
  label?: string;
}>();
const emit = defineEmits<{
  'update:modelValue': [date: string];
  /** Después de que la persona eligió otro día. */
  change: [];
}>();

const input = ref<HTMLInputElement | null>(null);

function openPicker(): void {
  try {
    input.value?.showPicker?.();
  } catch {
    // Si el navegador no permite abrir el calendario por código, queda el campo nativo.
  }
}

function onChange(event: Event): void {
  const field = event.target as HTMLInputElement;
  if (!field.value) {
    // Si borran la fecha, se conserva la anterior.
    field.value = props.modelValue;
    return;
  }
  emit('update:modelValue', field.value);
  emit('change');
}
</script>

<template>
  <label class="date-block">
    <span class="date-icon"><AppIcon name="calendar" :size="18" /></span>
    <span class="date-text">
      <small>{{ label ?? 'FECHA' }}</small>
      <strong>{{ longDateLabel(modelValue) }}</strong>
    </span>
    <input
      ref="input"
      type="date"
      class="date-input"
      :value="modelValue"
      :min="min"
      :aria-label="label ?? 'Fecha'"
      @click="openPicker"
      @change="onChange"
    />
  </label>
</template>

<style scoped>
.date-block { position: relative; display: flex; align-items: center; gap: 12px; padding: 14px 16px; cursor: pointer;
  border: 1px solid #b7d9d1; border-radius: 12px; background: var(--color-brand-soft); }
.date-icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 9px; background: #fff; color: var(--color-brand); }
.date-text { display: grid; line-height: 1.3; }
.date-text small { color: var(--color-brand); font-size: 0.66rem; font-weight: 700; letter-spacing: 0.08em; }
.date-text strong { font-size: 0.95rem; color: var(--color-brand-dark); }
.date-input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
.date-block:focus-within { box-shadow: 0 0 0 3px var(--color-brand-soft); border-color: var(--color-brand); }
</style>
