<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { RouterLink } from 'vue-router';
import PatientPicker from '../../components/PatientPicker.vue';
import BaseCard from '../../components/ui/BaseCard.vue';
import NoticeBanner from '../../components/ui/NoticeBanner.vue';
import { useBedsRealtime } from '../../composables/useBedsRealtime';
import { useFeedback } from '../../composables/useFeedback';
import PageHeader from '../../components/ui/PageHeader.vue';
import StatusChip, { type ChipTone } from '../../components/ui/StatusChip.vue';
import { BED_STATUS_LABELS, BedConflictError, type BedStatus } from '../../services/beds';
import type { Patient } from '../../services/patients';
import { listarUsuarios } from '../../services/users';
import { messageFrom } from '../../shared/errors';
import { useBedsStore } from '../../stores/beds.store';
import { useSessionStore } from '../iam/session.store';

const props = defineProps<{ id: string }>();

const session = useSessionStore();
const store = useBedsStore();
const { beds, loading, error, admittedPatientIds } = storeToRefs(store);

const bed = computed(() => beds.value.find((b) => b.id === props.id));
const paciente = ref<Patient | null>(null);
const motivoIngreso = ref('');
const motivoBloqueo = ref('');
const medicoId = ref('');
const medicos = ref<{ id: string; nombre: string; apellido: string }[]>([]);
const medicosError = ref<string | null>(null);
const { toast } = useFeedback();
const working = ref(false);

const isAdmin = computed(() => session.role === 'ADMINISTRATIVO');
const canAssign = computed(() => session.role === 'MEDICO' || isAdmin.value);
const canClean = computed(() => session.role === 'ENFERMERO' || isAdmin.value);

const TONES: Record<BedStatus, ChipTone> = { DISPONIBLE: 'success', OCUPADA: 'info', EN_LIMPIEZA: 'warning', MANTENIMIENTO: 'neutral' };

const ingresoText = computed(() => motivoIngreso.value.trim());
const bloqueoText = computed(() => motivoBloqueo.value.trim());
const ingresoValid = computed(() => ingresoText.value === '' || ingresoText.value.length >= 3);
const canSubmitAssign = computed(() => !!paciente.value && ingresoValid.value && (!isAdmin.value || medicoId.value !== '') && !working.value);
const location = computed(() => {
  const current = bed.value;
  if (!current) return '';
  return [current.sector ?? 'Sin sector', current.habitacion ? `Habitación ${current.habitacion}` : null].filter(Boolean).join(' · ');
});

async function run(operation: () => Promise<void>, success: string): Promise<void> {
  working.value = true;
  try {
    await operation();
    toast.success(success);
  } catch (reason) {
    // Por ejemplo, otra persona ocupó la cama un instante antes: el mapa ya se refrescó.
    const title = reason instanceof BedConflictError ? 'La cama cambió mientras la operabas' : 'No se pudo completar la acción';
    toast.error(messageFrom(reason), { title });
  } finally {
    working.value = false;
  }
}

async function assign(): Promise<void> {
  const current = bed.value;
  const chosen = paciente.value;
  if (!current || !chosen) return;
  await run(
    () =>
      store.assign(current.id, {
        pacienteId: chosen.id,
        medicoId: isAdmin.value ? medicoId.value : undefined,
        motivoIngreso: ingresoText.value || undefined,
      }),
    `Cama ${current.numero} asignada a ${chosen.nombre} ${chosen.apellido}.`,
  );
  paciente.value = null;
  motivoIngreso.value = '';
}

async function block(): Promise<void> {
  const current = bed.value;
  if (!current) return;
  await run(() => store.block(current.id, bloqueoText.value), 'Cama bloqueada por mantenimiento.');
  motivoBloqueo.value = '';
}

async function loadDoctors(): Promise<void> {
  if (!isAdmin.value) return;
  try {
    medicos.value = (await listarUsuarios()).filter((u) => u.rol === 'MEDICO' && u.estado === 'ACTIVO');
  } catch (reason) {
    medicosError.value = messageFrom(reason, 'No se pudo cargar la lista de médicos.');
  }
}

onMounted(() => {
  if (beds.value.length === 0) void store.load();
  void loadDoctors();
});
useBedsRealtime();
</script>

<template>
  <div class="page">
    <RouterLink :to="{ name: 'beds' }">← Volver al mapa de camas</RouterLink>

    <NoticeBanner v-if="error" tone="error">{{ error }}</NoticeBanner>
    <p v-else-if="loading && !bed" role="status">Cargando cama...</p>
    <NoticeBanner v-else-if="!bed" tone="warning">Cama no encontrada.</NoticeBanner>

    <template v-else>
      <PageHeader :title="`Cama ${bed.numero}`" :subtitle="location">
        <StatusChip :label="BED_STATUS_LABELS[bed.estado]" :tone="TONES[bed.estado]" />
      </PageHeader>


      <div class="grid-eq">
        <BaseCard>
          <template #header><h3>Detalle</h3></template>
          <dl>
            <dt>Estado</dt><dd>{{ BED_STATUS_LABELS[bed.estado] }}</dd>
            <dt>Paciente</dt><dd>{{ bed.paciente?.nombre ?? 'Sin paciente asignado' }}</dd>
            <template v-if="bed.estado === 'MANTENIMIENTO'">
              <dt>Motivo del bloqueo</dt><dd>{{ bed.motivoBloqueo ?? '—' }}</dd>
            </template>
          </dl>
        </BaseCard>

        <BaseCard>
          <template #header><h3>Acciones</h3></template>
          <div class="stack">
            <template v-if="bed.estado === 'DISPONIBLE'">
              <template v-if="canAssign">
                <PatientPicker v-model="paciente" label="Paciente a internar" :exclude-ids="admittedPatientIds" />
                <label v-if="isAdmin">
                  Médico responsable
                  <select v-model="medicoId">
                    <option value="" disabled>Elegí un médico</option>
                    <option v-for="m in medicos" :key="m.id" :value="m.id">{{ m.nombre }} {{ m.apellido }}</option>
                  </select>
                </label>
                <p v-if="medicosError" class="field-error" role="alert">{{ medicosError }}</p>
                <label>
                  Motivo de ingreso (opcional)
                  <input v-model="motivoIngreso" type="text" maxlength="200" placeholder="Por ejemplo: cirugía programada" />
                </label>
                <p v-if="!ingresoValid" class="field-error" role="alert">El motivo debe tener al menos 3 caracteres.</p>
                <button class="btn" type="button" :disabled="!canSubmitAssign" @click="assign">Asignar cama</button>
              </template>
              <p v-else class="muted">Solo médicos y administración pueden asignar camas.</p>
              <template v-if="isAdmin">
                <label>
                  Motivo del bloqueo
                  <input v-model="motivoBloqueo" type="text" maxlength="500" placeholder="Por ejemplo: mantenimiento preventivo" />
                </label>
                <button class="btn btn-secondary" type="button" :disabled="working || bloqueoText.length < 3" @click="block">
                  Bloquear por mantenimiento
                </button>
              </template>
            </template>

            <template v-else-if="bed.estado === 'OCUPADA'">
              <p class="muted">Al dar el alta, la cama pasa a limpieza y no puede asignarse hasta higienizarla.</p>
              <button v-if="canAssign" class="btn" type="button" :disabled="working" @click="run(() => store.discharge(bed!.id), 'Alta registrada. La cama pasó a limpieza.')">
                Registrar alta o traslado
              </button>
              <p v-else class="muted">Solo médicos y administración pueden registrar altas.</p>
            </template>

            <template v-else-if="bed.estado === 'EN_LIMPIEZA'">
              <p class="muted">Cama bloqueada hasta que maestranza confirme la higiene.</p>
              <button v-if="canClean" class="btn" type="button" :disabled="working" @click="run(() => store.clean(bed!.id), 'Limpieza confirmada. La cama está libre.')">
                Confirmar limpieza
              </button>
              <p v-else class="muted">Solo enfermería y administración pueden confirmar la limpieza.</p>
            </template>

            <template v-else>
              <p class="muted">Fuera de servicio por mantenimiento técnico.</p>
              <button v-if="isAdmin" class="btn" type="button" :disabled="working" @click="run(() => store.unblock(bed!.id), 'Cama habilitada.')">
                Habilitar cama
              </button>
              <p v-else class="muted">Solo administración puede habilitar camas.</p>
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
