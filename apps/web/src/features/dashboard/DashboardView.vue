<script setup lang="ts">
import { useSessionStore } from '../iam/session.store.ts';

const session = useSessionStore();
</script>

<template>
  <h1>Panel</h1>
  <p>Hola, {{ session.fullName }}. Acá va el resumen del día; se conecta al final, tarjeta por tarjeta.</p>
</template>