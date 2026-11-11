<script setup lang="ts">
import { computed } from 'vue';
import { COBERTURAS, opcionDe, type CoberturaForm } from './coverage-ui';

const model = defineModel<CoberturaForm>({ required: true });
const props = defineProps<{ errors?: { tipo?: string; entidad?: string }; disabled?: boolean }>();

const opcion = computed(() => opcionDe(model.value.tipo));
const idBase = `cobertura-${Math.random().toString(36).slice(2, 8)}`;

function elegir(tipo: CoberturaForm['tipo']): void {
  model.value = { tipo, entidad: opcionDe(tipo)?.entidadLabel ? model.value.entidad : '' };
}
</script>

<template>
  <fieldset class="coverage" :disabled="props.disabled">
    <legend class="visually-hidden">Tipo de cobertura</legend>
    <div class="options" role="radiogroup" aria-label="Tipo de cobertura">
      <label v-for="c in COBERTURAS" :key="c.tipo" class="option" :class="{ selected: model.tipo === c.tipo }">
        <input type="radio" :name="idBase" :value="c.tipo" :checked="model.tipo === c.tipo" @change="elegir(c.tipo)" />
        <span class="text"><strong>{{ c.titulo }}</strong><small>{{ c.descripcion }}</small></span>
      </label>
    </div>
    <span v-if="props.errors?.tipo" class="field-error" role="alert">{{ props.errors.tipo }}</span>

    <label v-if="opcion?.entidadLabel" class="entity">
      <span>
        {{ opcion.entidadLabel }}
        <span v-if="opcion.entidadObligatoria" aria-hidden="true"> *</span>
        <span v-else class="hint">(opcional)</span>
      </span>
      <input
        :value="model.entidad"
        maxlength="100"
        autocomplete="off"
        :placeholder="opcion.tipo === 'MEDICINA_PREPAGA' ? 'Ej. Medicina Prepaga Premium' : 'Ej. APROSS'"
        @input="model = { ...model, entidad: ($event.target as HTMLInputElement).value }"
      />
      <span v-if="props.errors?.entidad" class="field-error" role="alert">{{ props.errors.entidad }}</span>
    </label>
  </fieldset>
</template>

<style scoped>
.coverage { display: grid; gap: 10px; margin: 0; padding: 0; border: 0; min-width: 0; }
.options { display: grid; gap: 8px; }
.option { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border: 1px solid var(--color-line); border-radius: 12px; background: #fff; cursor: pointer; }
.option:hover { border-color: var(--color-brand); }
.option.selected { border-color: var(--color-brand); background: var(--color-brand-soft); }
.option input { width: 18px; height: 18px; margin-top: 2px; accent-color: var(--color-brand); flex: none; }
.text { display: grid; gap: 2px; line-height: 1.35; }
.text small { color: var(--color-muted); font-size: 0.78rem; }
.entity { display: grid; gap: 6px; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
