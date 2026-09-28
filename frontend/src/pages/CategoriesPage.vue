<script setup lang="ts">
import { useFinanceData } from '@/composables/useFinanceData';
import CategoryManager from '@/components/CategoryManager.vue';

const { categories, categoryGroups, refresh, setError } = useFinanceData();
</script>

<template>
  <CategoryManager
    :categories="categories"
    :groups="categoryGroups"
    @changed="refresh"
    @error="setError"
  />
</template>
