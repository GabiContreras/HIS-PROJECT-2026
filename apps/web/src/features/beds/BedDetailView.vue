<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { RouterLink } from 'vue-router';
import PatientPicker from '../../components/PatientPicker.vue';
import BaseCard from '../../components/ui/BaseCard.vue';
import NoticeBanner from '../../components/ui/NoticeBanner.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import StatusChip, { type ChipTone } from '../../components/ui/StatusChip.vue';
import { BED_STATUS_LABELS, type BedStatus } from '../../services/beds';
import type { Patient } from '../../services/patients';
import { messageFrom } from '../../shared/errors';
import { formatDateTime } from '../../shared/format';
import { useBedsStore } from '../../stores/beds.store';
import { useSessionStore } from '../iam/session.store';

const props = defineProps<{ id: string }>();

const session = useSessionStore();
const store = useBedsStore();
const { beds, loading, error } = storeToRefs(store);

const bed = computed(() => beds.value.find((b) => b.id === props.id));
const paciente = ref<Patient | null>(null);
const aviso = ref<string | null>(null);
const fallo = ref<string | null>(null);
const working = ref(false);

// Asignar, dar de alta y bloquear: administrativo. Confirmar la limpieza: también enfermería.
const canManage = computed(() => session.role === 'ADMINISTRATIVO');
const canClean = computed(() => session.role === 'ADMINISTRATIVO' || session.role === 'ENFERMERO');

const TONES: Record<BedStatus, ChipTone> = { DISPONIBLE: 'success', OCUPADA: 'info', EN_LIMPIEZA: 'warning', MANTENIMIENTO: 'neutral' };

async function run(operation: () => Promise<void>, success: string): Promise<void> {
  working.value = true;
  aviso.value = null;
  fallo.value = null;
  try {
    await operation();
    aviso.value = success;
  } catch (reason) {
    // Por ejemplo, otra persona ocupó la cama un instante antes: el mapa ya se refrescó.
    fallo.value = messageFrom(reason);
  } finally {
    working.value = false;
  }
}

async function assign(): Promise<void> {
  const current = bed.value;
  const chosen = paciente.value;
  if (!current || !chosen) return;
  await run(
    () => store.assign(current.id, { id: chosen.id, nombre: `${chosen.nombre} ${chosen.apellido}` }, current.version),
    `Cama ${current.numero} asignada a ${chosen.nombre} ${chosen.apellido}.`,
  );
  paciente.value = null;
}

onMounted(() => {
  if (beds.value.length === 0) void store.load();
});
</script>

<template>
  <div class="page">
    <RouterLink :to="{ name: 'beds' }">← Volver al mapa de camas</RouterLink>

    <NoticeBanner v-if="error" tone="error">{{ error }}</NoticeBanner>
    <p v-else-if="loading && !bed" role="status">Cargando cama...</p>
    <NoticeBanner v-else-if="!bed" tone="warning">Cama no encontrada.</NoticeBanner>

    <template v-else>
      <PageHeader :title="`Cama ${bed.numero}`" :subtitle="bed.sector">
        <StatusChip :label="BED_STATUS_LABELS[bed.estado]" :tone="TONES[bed.estado]" />
      </PageHeader>

      <NoticeBanner v-if="aviso" tone="success">{{ aviso }}</NoticeBanner>
      <NoticeBanner v-if="fallo" tone="error" title="No se pudo completar la acción">{{ fallo }}</NoticeBanner>

      <div class="grid-eq">
        <BaseCard>
          <template #header><h3>Detalle</h3></template>
          <dl>
            <dt>Estado</dt><dd>{{ BED_STATUS_LABELS[bed.estado] }}</dd>
            <dt>Paciente</dt><dd>{{ bed.paciente?.nombre ?? 'Sin paciente asignado' }}</dd>
            <dt>Ingreso</dt><dd>{{ bed.ingresoAt ? formatDateTime(bed.ingresoAt) : '—' }}</dd>
          </dl>
        </BaseCard>

        <BaseCard>
          <template #header><h3>Acciones</h3></template>
          <div class="stack">
            <template v-if="bed.estado === 'DISPONIBLE'">
              <template v-if="canManage">
                <PatientPicker v-model="paciente" label="Paciente a internar" />
                <button class="btn" type="button" :disabled="!paciente || working" @click="assign">Asignar cama</button>
                <button class="btn btn-secondary" type="button" :disabled="working" @click="run(() => store.toggleBlocked(bed!.id), 'Cama bloqueada por mantenimiento.')">
                  Bloquear por mantenimiento
                </button>
              </template>
              <p v-else class="muted">Solo administración puede asignar camas.</p>
            </template>

            <template v-else-if="bed.estado === 'OCUPADA'">
              <p class="muted">Al dar el alta, la cama pasa a limpieza y no puede asignarse hasta higienizarla.</p>
              <button v-if="canManage" class="btn" type="button" :disabled="working" @click="run(() => store.discharge(bed!.id), 'Alta registrada. La cama pasó a limpieza.')">
                Registrar alta o traslado
              </button>
              <p v-else class="muted">Solo administración puede registrar altas.</p>
            </template>

            <template v-else-if="bed.estado === 'EN_LIMPIEZA'">
              <p class="muted">Cama bloqueada hasta que maestranza confirme la higiene.</p>
              <button v-if="canClean" class="btn" type="button" :disabled="working" @click="run(() => store.clean(bed!.id), 'Limpieza confirmada. La cama está libre.')">
                Confirmar limpieza
              </button>
            </template>

            <template v-else>
              <p class="muted">Fuera de servicio por mantenimiento técnico.</p>
              <button v-if="canManage" class="btn" type="button" :disabled="working" @click="run(() => store.toggleBlocked(bed!.id), 'Cama habilitada.')">
                Habilitar cama
              </button>
            </template>
          </div>
        </BaseCard>
      </div>
    </template>
  </div>
</template>

<style scoped>
dl { display: grid; gap: 4px; margin: 0; }
dt { color: var(--color-muted); font-size: 0.75rem; margin-top: 10px; }
dd { margin: 0; font-weight: 600; }
.stack { display: grid; gap: 12px; }
</style>
