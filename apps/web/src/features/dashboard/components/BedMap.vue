<script setup lang="ts">


const emit = defineEmits<{
  (e: 'select', cama: any): void
}>();

// Datos de camas mock o tomados del composable/store
const camas = [
  { id: 1, numero: 101, estado: 'OCUPADA', pacienteActual: { apellido: 'Pérez' } },
  { id: 2, numero: 102, estado: 'DISPONIBLE', pacienteActual: null },
  // ... resto de las 30 camas
];
</script>

<template>
  <div class="bed-map">
    <h3>Mapa de Camas</h3>
    <div class="bed-grid">
      <button 
        v-for="c in camas" 
        :key="c.id" 
        class="cama" 
        :class="`cama-${c.estado.toLowerCase()}`"
        :title="c.estado === 'OCUPADA' ? `${c.pacienteActual?.apellido} · Cama ${c.numero}` : `Cama ${c.numero} disponible`"
        @click="emit('select', c)"
      >
        {{ c.numero }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.bed-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}
.cama {
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
}
.cama-ocupada {
  background-color: #fee2e2;
  border-color: #f87171;
}
.cama-disponible {
  background-color: #dcfce7;
  border-color: #4ade80;
}
</style>