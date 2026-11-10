<script setup lang="ts">
import BaseCard from '../../../components/ui/BaseCard.vue';
import { ingresoTypeLabel, type Protocol } from '../../../services/protocols';
import { displayName, formatDateTime } from '../../../shared/format';

const props = defineProps<{
  protocol: Protocol;
  /** Ids de tareas con un guardado en curso (casilla deshabilitada). */
  pending?: ReadonlySet<string>;
  /** Solo lectura (no se puede marcar). */
  readonly?: boolean;
}>();

const emit = defineEmits<{
  toggle: [payload: { protocolId: string; taskId: string; hecha: boolean }];
}>();

function onChange(taskId: string, event: Event): void {
  emit('toggle', { protocolId: props.protocol.id, taskId, hecha: (event.target as HTMLInputElement).checked });
}
</script>

<template>
  <BaseCard>
    <template #header><h3>{{ ingresoTypeLabel(protocol.tipo) }}</h3></template>
    <p class="muted meta">{{ protocol.motivoIngreso }} · generado el {{ formatDateTime(protocol.generadoEn) }}</p>
    <ul class="tasks">
      <li v-for="task in protocol.tareas" :key="task.id">
        <label class="task">
          <input
            type="checkbox"
            :checked="task.hecha"
            :disabled="readonly || pending?.has(task.id)"
            @change="onChange(task.id, $event)"
          />
          <span>
            <span :class="{ done: task.hecha }">{{ task.descripcion }}</span>
            <small v-if="task.frecuenciaHoras" class="muted"> · cada {{ task.frecuenciaHoras }} h</small>
            <small v-if="task.hecha" class="muted who">
              <template v-if="pending?.has(task.id)">Guardando...</template>
              <template v-else-if="task.hechaEn">
                Marcada por {{ task.hechaPor ? displayName(task.hechaPor) : 'un usuario dado de baja' }} · {{ formatDateTime(task.hechaEn) }}
              </template>
            </small>
          </span>
        </label>
      </li>
    </ul>
  </BaseCard>
</template>

<style scoped>
.meta { margin: 0; font-size: 0.85rem; }
.tasks { list-style: none; margin: 12px 0 0; padding: 0; }
.tasks li { border-bottom: 1px solid var(--color-line); }
.tasks li:last-child { border-bottom: 0; }
.task { display: flex; align-items: flex-start; gap: 10px; padding: 12px 2px; font-weight: 500; font-size: 0.9rem; }
.task input { width: auto; margin-top: 3px; }
.who { display: block; }
.done { text-decoration: line-through; color: var(--color-muted); }
</style>
