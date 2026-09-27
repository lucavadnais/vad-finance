<script setup lang="ts">
import type { ParseError } from '@/types';

defineProps<{ errors: ParseError[] }>();
</script>

<template>
  <ul v-if="errors.length > 0" class="mb-2 text-sm text-destructive">
    <li v-for="e in errors" :key="e.line">Ligne {{ e.line }} : {{ e.error }}</li>
  </ul>
</template>
