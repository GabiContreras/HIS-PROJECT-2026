
<script setup lang="ts">
import UsuariosForm from './components/UsuariosForm.vue';
import PacientesForm from './components/PacientesForm.vue';
</script>

<template>
  <main class="app-container">
    <h1>HIS - Sistema de Gestión Hospitalaria</h1>

    <section class="seccion">
      <UsuariosForm />
    </section>

    <hr />

    <section class="seccion">
      <PacientesForm />
    </section>
  </main>
</template>

<style scoped>
.app-container {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
}

.seccion {
  margin: 32px 0;
}

hr {
  margin: 32px 0;
  border: 0;
  border-top: 1px solid #ddd;
}
</style>
