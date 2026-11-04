<script setup lang="ts">
import { ref } from 'vue';
import PatientPicker from '../../components/PatientPicker.vue';
import BaseCard from '../../components/ui/BaseCard.vue';
import NoticeBanner from '../../components/ui/NoticeBanner.vue';
import { ADMISSION_REASONS, buildProtocol, type AdmissionReason, type CareProtocol } from '../../services/protocols';
import type { Patient } from '../../services/patients';

const reasons = Object.entries(ADMISSION_REASONS) as [AdmissionReason, string][];
const reason = ref<AdmissionReason>('PRE_QUIRURGICO');
const paciente = ref<Patient | null>(null);
const protocol = ref<CareProtocol | null>(null);
const forName = ref('');

function generate(): void {
  if (!paciente.value) return;
  protocol.value = buildProtocol(reason.value);
  forName.value = `${paciente.value.nombre} ${paciente.value.apellido}`;
}
</script>

<template>
  <div class="grid-eq">
    <BaseCard>
      <template #header><h3>Ingreso del paciente</h3></template>
      <div class="form-grid">
        <label class="full">
          Motivo de ingreso
          <select v-model="reason">
            <option v-for="[key, label] in reasons" :key="key" :value="key">{{ label }}</option>
          </select>
        </label>
        <div class="full"><PatientPicker v-model="paciente" label="Paciente admitido" /></div>
      </div>
      <div class="form-actions">
        <button class="btn" type="button" :disabled="!paciente" @click="generate">Generar protocolo</button>
      </div>
    </BaseCard>

    <BaseCard>
      <template #header><h3>{{ protocol ? protocol.nombre : 'Plan de cuidados' }}</h3></template>
      <p v-if="!protocol" class="muted">Elegí el motivo de ingreso y un paciente para armar el protocolo base.</p>
      <template v-else>
        <NoticeBanner tone="info">Protocolo generado automáticamente para {{ forName }}.</NoticeBanner>
        <ul class="tasks">
          <li v-for="task in protocol.tareas" :key="task.id">
            <label class="task">
              <input v-model="task.hecha" type="checkbox" />
              <span :class="{ done: task.hecha }">{{ task.descripcion }}</span>
            </label>
          </li>
        </ul>
      </template>
    </BaseCard>
  </div>
</template>

<style scoped>
.tasks { list-style: none; margin: 12px 0 0; padding: 0; }
.tasks li { border-bottom: 1px solid var(--color-line); }
.tasks li:last-child { border-bottom: 0; }
.task { display: flex; align-items: center; gap: 10px; padding: 12px 2px; font-weight: 500; font-size: 0.9rem; }
.task input { width: auto; }
.done { text-decoration: line-through; color: var(--color-muted); }
</style>
