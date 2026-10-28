<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import BaseCard from '../../components/ui/BaseCard.vue';
import NoticeBanner from '../../components/ui/NoticeBanner.vue';
import StatusChip from '../../components/ui/StatusChip.vue';
import { ADMIN_WINDOW_MIN, minutesToSchedule, withinWindow, type Medication } from '../../services/medications';
import { messageFrom } from '../../shared/errors';
import { formatTime } from '../../shared/format';
import { useInventoryStore } from '../../stores/inventory.store';
import { useMedicationsStore } from '../../stores/medications.store';
import { useSessionStore } from '../iam/session.store';

const session = useSessionStore();
const store = useMedicationsStore();
const inventory = useInventoryStore();
const { medications, pending, loading, error } = storeToRefs(store);

const canAdminister = computed(() => session.role === 'ENFERMERO');
const aviso = ref<string | null>(null);
const fallo = ref<string | null>(null);
const working = ref(false);

function windowText(m: Medication): string {
  const diff = minutesToSchedule(m);
  if (withinWindow(m)) return 'Dentro de ventana';
  return diff > 0 ? `Faltan ${diff} min` : `Vencida hace ${-diff} min`;
}

async function administer(m: Medication): Promise<void> {
  working.value = true;
  aviso.value = null;
  fallo.value = null;
  try {
    await store.administer(m.id);
    const supply = m.insumoId ? inventory.items.find((i) => i.id === m.insumoId) : undefined;
    aviso.value = supply
      ? `Dosis registrada a nombre de ${session.fullName}. Stock de ${supply.nombre}: ${supply.cantidadDisponible} ${supply.unidadMedida}.`
      : `Dosis registrada a nombre de ${session.fullName}.`;
  } catch (reason) {
    fallo.value = messageFrom(reason);
  } finally {
    working.value = false;
  }
}

onMounted(() => Promise.all([store.load(), inventory.load()]));
</script>

<template>
  <div class="page">
    <p class="muted">
      {{ pending.length }} pendientes de {{ medications.length }}. Se puede administrar con un margen de ±{{ ADMIN_WINDOW_MIN }} minutos
      sobre el horario indicado; el insumo se descuenta del inventario.
    </p>
    <NoticeBanner v-if="aviso" tone="success">{{ aviso }}</NoticeBanner>
    <NoticeBanner v-if="fallo" tone="error">{{ fallo }}</NoticeBanner>
    <NoticeBanner v-if="!canAdminister" tone="info">Solo enfermería registra la administración. Vos podés consultar el estado.</NoticeBanner>

    <BaseCard>
      <template #header><h3>Indicaciones del día</h3></template>
      <NoticeBanner v-if="error" tone="error">
        {{ error }} <button type="button" class="btn-sm" @click="store.load">Reintentar</button>
      </NoticeBanner>
      <p v-else-if="loading && medications.length === 0" role="status">Cargando medicaciones...</p>
      <p v-else-if="medications.length === 0" class="muted">No hay medicaciones indicadas.</p>
      <div v-else class="scroll-x">
        <table>
          <thead><tr><th>Horario</th><th>Paciente</th><th>Medicación</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            <tr v-for="m in medications" :key="m.id">
              <td><strong>{{ formatTime(m.programadaAt) }}</strong></td>
              <td>{{ m.paciente }}</td>
              <td>{{ m.medicamento }} {{ m.dosis }}<br /><small class="muted">{{ m.indicacion }}</small></td>
              <td>
                <StatusChip
                  v-if="m.estado === 'ADMINISTRADA'"
                  label="Administrada"
                  tone="success"
                />
                <StatusChip v-else :label="windowText(m)" :tone="withinWindow(m) ? 'info' : 'neutral'" />
                <br /><small v-if="m.administradaPor" class="muted">Por {{ m.administradaPor }}</small>
              </td>
              <td>
                <button
                  v-if="m.estado === 'PENDIENTE' && canAdminister"
                  class="btn btn-sm"
                  type="button"
                  :disabled="working || !withinWindow(m)"
                  :title="withinWindow(m) ? '' : 'Fuera del margen permitido'"
                  @click="administer(m)"
                >
                  Administrar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </BaseCard>
  </div>
</template>
