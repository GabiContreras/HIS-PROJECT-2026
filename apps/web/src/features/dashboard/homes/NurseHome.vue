<script setup lang="ts">
import { onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { RouterLink, useRouter } from 'vue-router';
import BedsOverview from '../../../components/BedsOverview.vue';
import TriageList from '../../../components/TriageList.vue';
import VitalsList from '../../../components/VitalsList.vue';
import BaseCard from '../../../components/ui/BaseCard.vue';
import PageHeader from '../../../components/ui/PageHeader.vue';
import StatCard from '../../../components/ui/StatCard.vue';
import StatusChip from '../../../components/ui/StatusChip.vue';
import type { Bed } from '../../../services/beds';
import { minutesToSchedule, withinWindow } from '../../../services/medications';
import { formatTime, greeting, longDate } from '../../../shared/format';
import { useBedsStore } from '../../../stores/beds.store';
import { useInventoryStore } from '../../../stores/inventory.store';
import { useMedicationsStore } from '../../../stores/medications.store';
import { useTriageStore } from '../../../stores/triage.store';
import { useVitalsStore } from '../../../stores/vitals.store';
import { useSessionStore } from '../../iam/session.store';

const session = useSessionStore();
const router = useRouter();
const beds = useBedsStore();
const inventory = useInventoryStore();
const medications = useMedicationsStore();
const triage = useTriageStore();
const vitals = useVitalsStore();
const { pending } = storeToRefs(medications);
const { queue } = storeToRefs(triage);
const { latest } = storeToRefs(vitals);
const { lowStock } = storeToRefs(inventory);

function openBed(bed: Bed): void {
  void router.push({ name: 'bed-detail', params: { id: bed.id } });
}

onMounted(() => Promise.all([beds.load(), inventory.load(), medications.load(), triage.load(), vitals.load()]));
</script>

<template>
  <div class="page">
    <PageHeader :title="greeting(session.account?.nombre)" :subtitle="`Tu turno de enfermería, ${longDate()}.`">
      <RouterLink class="btn" :to="{ name: 'vital-signs' }">Registrar signos vitales</RouterLink>
      <RouterLink class="btn btn-secondary" :to="{ name: 'triage' }">Nuevo ingreso a guardia</RouterLink>
    </PageHeader>

    <div class="stats">
      <StatCard titulo="Medicaciones pendientes" :valor="pending.length" detalle="Para administrar" tone="violet" />
      <StatCard titulo="En cola de triaje" :valor="queue.length" detalle="Pacientes esperando" tone="warning" />
      <StatCard titulo="Camas ocupadas" :valor="`${beds.occupied} de ${beds.total}`" detalle="Internación" tone="brand" />
      <StatCard titulo="Insumos con stock bajo" :valor="lowStock.length" detalle="Avisar para reponer" tone="danger" />
    </div>

    <div class="grid-2">
      <BaseCard>
        <template #header><h3>Medicaciones pendientes</h3></template>
        <template #action><RouterLink :to="{ name: 'medications' }">Administrar →</RouterLink></template>
        <p v-if="pending.length === 0" class="muted">No hay medicaciones pendientes.</p>
        <ul v-else class="list">
          <li v-for="m in pending.slice(0, 5)" :key="m.id">
            <div class="who">
              <strong>{{ m.paciente }}</strong>
              <small>{{ m.medicamento }} {{ m.dosis }} · {{ formatTime(m.programadaAt) }}</small>
            </div>
            <StatusChip
              :label="withinWindow(m) ? 'Dentro de ventana' : minutesToSchedule(m) > 0 ? 'Aún no' : 'Vencida'"
              :tone="withinWindow(m) ? 'success' : 'neutral'"
            />
          </li>
        </ul>
      </BaseCard>

      <BaseCard>
        <template #header><h3>Cola de triaje</h3></template>
        <template #action><RouterLink :to="{ name: 'triage' }">Ver cola →</RouterLink></template>
        <TriageList :entries="queue" :limit="5" />
      </BaseCard>
    </div>

    <div class="grid-eq">
      <BaseCard>
        <template #header><h3>Últimos signos vitales</h3></template>
        <template #action><RouterLink :to="{ name: 'vital-signs' }">Ver todos →</RouterLink></template>
        <VitalsList :records="latest" />
      </BaseCard>

      <BaseCard>
        <template #header><h3>Mapa de camas</h3></template>
        <template #action><RouterLink :to="{ name: 'beds' }">Ver camas →</RouterLink></template>
        <BedsOverview @select="openBed" />
      </BaseCard>
    </div>
  </div>
</template>
