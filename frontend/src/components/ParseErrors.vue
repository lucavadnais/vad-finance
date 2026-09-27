<script setup>
defineProps({ errors: { type: Array, required: true } });
</script>

<template>
  <ul v-if="errors.length > 0" class="error mb-2 text-sm">
    <li v-for="e in errors" :key="e.line">Ligne {{ e.line }} : {{ e.error }}</li>
  </ul>
</template>
