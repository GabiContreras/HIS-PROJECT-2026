<script setup lang="ts">
import { ref, watch } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import PatientPicker from '../../components/PatientPicker.vue';
import BaseCard from '../../components/ui/BaseCard.vue';
import NoticeBanner from '../../components/ui/NoticeBanner.vue';
import { ADMISSION_REASONS, saveAdmissionProtocol, type AdmissionReason } from '../../services/protocols';
import { messageFrom } from '../../shared/errors';
import type { Patient } from '../../services/patients';

/** Vista que orquesta: formulario de ingreso + checklist del paciente elegido (ruta hija `:pacienteId`). */
const router = useRouter();
const route = useRoute();

const reasons = Object.entries(ADMISSION_REASONS) as [AdmissionReason, string][];
const reason = ref<AdmissionReason>('PRE_QUIRURGICO');
const paciente = ref<Patient | null>(null);
const generating = ref(false);
const saveNotice = ref<{ tone: 'success' | 'warning'; text: string } | null>(null);
const checklist = ref<{ reload: () => Promise<void> } | null>(null);

// Elegir (o quitar) un paciente navega a la ruta dinámica; abrir la URL directa carga igual su protocolo.
watch(paciente, (selected) => {
  saveNotice.value = null;
  if (selected) {
    if (route.params.pacienteId !== selected.id) {
      void router.push({ name: 'protocol-patient', params: { pacienteId: selected.id } });
    }
  } else if (route.params.pacienteId) {
    void router.push({ name: 'protocols' });
  }
});

async function generate(): Promise<void> {
  if (!paciente.value) return;
  generating.value = true;
  saveNotice.value = null;
  try {
    await saveAdmissionProtocol(paciente.value.id, reason.value);
    saveNotice.value = { tone: 'success', text: 'Protocolo guardado en el sistema.' };
    // Se recarga desde el backend para que las tareas tengan sus ids reales.
    await checklist.value?.reload();
  } catch (error) {
    saveNotice.value = { tone: 'warning', text: `No se pudo guardar el protocolo: ${messageFrom(error)}` };
  } finally {
    generating.value = false;
  }
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
      <NoticeBanner v-if="saveNotice" :tone="saveNotice.tone">{{ saveNotice.text }}</NoticeBanner>
      <div class="form-actions">
        <button class="btn" type="button" :disabled="!paciente || generating" @click="generate">
          {{ generating ? 'Generando...' : 'Generar protocolo' }}
        </button>
      </div>
    </BaseCard>

    <RouterView v-slot="{ Component }">
      <component :is="Component" v-if="Component" ref="checklist" />
      <BaseCard v-else>
        <template #header><h3>Plan de cuidados</h3></template>
        <p class="muted">Elegí un paciente para ver su protocolo, o generá uno nuevo con el motivo de ingreso.</p>
      </BaseCard>
    </RouterView>
  </div>
</template>
