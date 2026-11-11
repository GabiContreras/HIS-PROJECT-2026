<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import BaseCard from '../../components/ui/BaseCard.vue';
import NoticeBanner from '../../components/ui/NoticeBanner.vue';
import { useProtocols } from '../../composables/useProtocols';
import { getPatient } from '../../services/patients';
import { useSessionStore } from '../iam/session.store';
import ProtocolChecklist from './components/ProtocolChecklist.vue';

const props = defineProps<{ pacienteId: string }>();

const session = useSessionStore();
const { protocols, loading, error, taskError, pendingTasks, load, clear, toggleTask } = useProtocols();
const patientName = ref('');
const canMark = computed(() => session.role === 'ENFERMERO' || session.role === 'MEDICO');

async function reload(): Promise<void> {
  await load(props.pacienteId);
}

watch(
  () => props.pacienteId,
  async (id) => {
    clear();
    patientName.value = '';
    getPatient(id)
      .then((p) => {
        if (id === props.pacienteId) patientName.value = `${p.nombre} ${p.apellido}`;
      })
      .catch(() => undefined);
    await load(id);
  },
  { immediate: true },
);

defineExpose({ reload });
</script>

<template>
  <div class="stack">
    <NoticeBanner v-if="error" tone="error">
      {{ error }} <button type="button" class="btn-sm" @click="reload">Reintentar</button>
    </NoticeBanner>
    <p v-else-if="loading && protocols.length === 0" role="status">Cargando protocolo...</p>
    <BaseCard v-else-if="protocols.length === 0">
      <template #header><h3>Plan de cuidados</h3></template>
      <p class="muted">Este paciente todavía no tiene un protocolo de ingreso. Generalo desde el formulario.</p>
    </BaseCard>
    <template v-else>
      <NoticeBanner tone="info">Protocolos de ingreso de {{ patientName || 'este paciente' }}.</NoticeBanner>
      <NoticeBanner v-if="taskError" tone="warning">{{ taskError }}</NoticeBanner>
      <ProtocolChecklist
        v-for="protocol in protocols"
        :key="protocol.id"
        :protocol="protocol"
        :pending="pendingTasks"
        :readonly="!canMark"
        @toggle="({ protocolId, taskId, hecha }) => toggleTask(protocolId, taskId, hecha)"
      />
    </template>
  </div>
</template>

<style scoped>
.stack { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
</style>
