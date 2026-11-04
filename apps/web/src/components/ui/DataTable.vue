<script setup lang="ts">
// Definimos un tipo genérico o básico para los datos y columnas
defineProps<{
  data: Array<any>;
  columns: Array<{ key: string; label: string }>;
}>();
</script>

<template>
  <table class="data-table">
    <thead>
      <tr>
        <th v-for="col in columns" :key="col.key">
          <slot :name="`header-${col.key}`" :column="col">
            {{ col.label }}
          </slot>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, index) in data" :key="index">
        <td v-for="col in columns" :key="col.key">
          <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
            {{ row[col.key] }}
          </slot>
        </td>
      </tr>
    </tbody>
  </table>
</template>