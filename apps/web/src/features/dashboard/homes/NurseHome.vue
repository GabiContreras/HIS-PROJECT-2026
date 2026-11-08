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
import NoticeBanner from '../../../components/ui/NoticeBanner.vue';

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
      <StatCard
        titulo="Medicaciones pendientes"
        :valor="medications.loading ? 'Cargando...' : medications.error ? '—' : pending.length"
        :detalle="medications.error ? 'No se pudieron cargar los datos' : 'Para administrar'"
        tone="violet"
      />
      <StatCard
        titulo="En cola de triaje"
        :valor="triage.loading ? 'Cargando...' : triage.error ? '—' : queue.length"
        :detalle="triage.error ? 'No se pudieron cargar los datos' : 'Pacientes esperando'"
        tone="warning"
      />
      <StatCard
        titulo="Camas ocupadas"
        :valor="beds.loading ? 'Cargando...' : beds.error ? '—' : `${beds.occupied} de ${beds.total}`"
        :detalle="beds.error ? 'No se pudieron cargar los datos' : 'Internación'"
        tone="brand"
      />
      <StatCard
        titulo="Insumos con stock bajo"
        :valor="inventory.loading ? 'Cargando...' : inventory.error ? '—' : lowStock.length"
        :detalle="inventory.error ? 'No se pudieron cargar los datos' : 'Avisar para reponer'"
        tone="danger"
      />
    </div>

    <div class="grid-2">
      <BaseCard>
        <template #header><h3>Medicaciones pendientes</h3></template>
        <template #action><RouterLink :to="{ name: 'medications' }">Administrar →</RouterLink></template>
        <p v-if="medications.loading && pending.length === 0" role="status">
          Cargando medicaciones pendientes...
        </p>

        <NoticeBanner v-if="medications.error" tone="error">
          No se pudieron cargar las medicaciones: {{ medications.error }}
          <button type="button" class="btn-sm" @click="medications.load">
            Reintentar
          </button>
        </NoticeBanner>

        <p
          v-if="!medications.loading && !medications.error && pending.length === 0"
          class="muted"
        >
          No hay medicaciones pendientes.
        </p>
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
        <p v-if="triage.loading && queue.length === 0" role="status">
          Cargando cola de triaje...
        </p>

        <NoticeBanner v-if="triage.error" tone="error">
          No se pudo cargar la cola de triaje: {{ triage.error }}
          <button type="button" class="btn-sm" @click="triage.load">
            Reintentar
          </button>
        </NoticeBanner>

        <TriageList
          v-if="(!triage.loading && !triage.error) || queue.length > 0"
          :entries="queue"
          :limit="5"
        />
      </BaseCard>
    </div>

    <div class="grid-eq">
      <BaseCard>
        <template #header><h3>Últimos signos vitales</h3></template>
        <template #action><RouterLink :to="{ name: 'vital-signs' }">Ver todos →</RouterLink></template>
        <p v-if="vitals.loading && latest.length === 0" role="status">
          Cargando últimos signos vitales...
        </p>

        <NoticeBanner v-if="vitals.error" tone="error">
          No se pudieron cargar los signos vitales: {{ vitals.error }}
          <button type="button" class="btn-sm" @click="vitals.load">
            Reintentar
          </button>
        </NoticeBanner>

        <VitalsList
          v-if="(!vitals.loading && !vitals.error) || latest.length > 0"
          :records="latest"
        />
      </BaseCard>

      <BaseCard>
        <template #header><h3>Mapa de camas</h3></template>
        <template #action><RouterLink :to="{ name: 'beds' }">Ver camas →</RouterLink></template>
        <p v-if="beds.loading && beds.total === 0" role="status">
          Cargando mapa de camas...
        </p>

        <NoticeBanner v-if="beds.error" tone="error">
          No se pudo cargar el mapa de camas: {{ beds.error }}
          <button type="button" class="btn-sm" @click="beds.load">
            Reintentar
          </button>
        </NoticeBanner>

        <BedsOverview
          v-if="(!beds.loading && !beds.error) || beds.total > 0"
          @select="openBed"
        />
      </BaseCard>
    </div>
  </div>
</template>
