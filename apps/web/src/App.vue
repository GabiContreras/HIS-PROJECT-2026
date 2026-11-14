<script setup lang="ts">
import ConfirmHost from './components/feedback/ConfirmHost.vue';
import ToastHost from './components/feedback/ToastHost.vue';
</script>

<template>
  <RouterView />
  <ToastHost />
  <ConfirmHost />
</template>