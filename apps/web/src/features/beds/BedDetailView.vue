<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { BED_STATUS_LABELS, getBed, type Bed } from '../../services/beds';

const props = defineProps<{ id: string }>();
const router = useRouter();
const bed = ref<Bed | null>(null);
const loading = ref(true);

onMounted(async () => {
  bed.value = (await getBed(props.id)) ?? null;
  loading.value = false;
});
</script>

<template>
  <section>
    <button type="button" @click="router.back()">← Volver</button>
    <p v-if="loading" role="status">Cargando...</p>
    <p v-else-if="!bed">Cama no encontrada.</p>
    <article v-else class="card">
      <h1>Cama {{ bed.numero }}</h1>
      <dl>
        <dt>Sector</dt><dd>{{ bed.sector }}</dd>
        <dt>Estado</dt><dd>{{ BED_STATUS_LABELS[bed.estado] }}</dd>
        <dt>Paciente</dt><dd>{{ bed.paciente ?? 'Sin paciente asignado' }}</dd>
      </dl>
    </article>
  </section>
</template>

<style scoped>
.card { margin-top: var(--space-3); padding: var(--space-4); border: 1px solid var(--color-border);
  border-radius: var(--radius); background: var(--color-surface); max-width: 420px; }
dt { color: var(--color-muted); font-size: 0.85rem; margin-top: var(--space-2); }
dd { margin: 0; font-weight: 600; }
</style>