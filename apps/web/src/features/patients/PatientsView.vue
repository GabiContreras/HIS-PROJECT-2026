<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { usePatients } from '@/composables/usePatients';

const route = useRoute();
const { patients, loading, error, load } = usePatients();
const query = ref(String(route.query.q ?? ''));

watch(() => route.query.q, (q) => { query.value = String(q ?? ''); });

const visible = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return patients.value;
  return patients.value.filter((p) =>
    `${p.nombre} ${p.apellido}`.toLowerCase().includes(q) || p.documento.includes(q),
  );
});

function age(birth: string): number {
  const b = new Date(birth);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) years -= 1;
  return years;
}

onMounted(load);
</script>

<template>
  <section>
    <header class="head">
      <div>
        <h1>Pacientes</h1>
        <p>Buscá por nombre, apellido o documento.</p>
      </div>
      <input v-model="query" type="search" placeholder="Buscar paciente..." />
    </header>

    <p v-if="error" class="error" role="alert">
      {{ error }} <button type="button" :disabled="loading" @click="load">Reintentar</button>
    </p>
    <p v-else-if="loading" role="status">Cargando pacientes...</p>
    <p v-else-if="visible.length === 0">No se encontraron pacientes.</p>
    <table v-else>
      <thead>
        <tr><th>Paciente</th><th>Documento</th><th>Edad</th><th>Teléfono</th></tr>
      </thead>
      <tbody>
        <tr v-for="p in visible" :key="p.id">
          <td>{{ p.apellido }}, {{ p.nombre }}</td>
          <td>{{ p.documento }}</td>
          <td>{{ age(p.fechaNacimiento) }} años</td>
          <td>{{ p.telefono ?? '—' }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: end; flex-wrap: wrap; gap: var(--space-3); margin-bottom: var(--space-3); }
.head h1, .head p { margin: 0; }
.head p { color: var(--color-muted); margin-top: var(--space-1); }
.head input { font: inherit; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: 8px; min-width: 240px; }
table { width: 100%; border-collapse: collapse; background: var(--color-surface); border-radius: var(--radius); }
th, td { padding: var(--space-2) var(--space-3); text-align: left; border-bottom: 1px solid var(--color-border); }
th { color: var(--color-muted); font-size: 0.8rem; }
tbody tr:hover { background: #f1f5f9; }
.error { color: var(--color-danger); }
</style>