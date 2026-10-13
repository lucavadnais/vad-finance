<script lang="ts">
// Once per visit (module scope, kept across the step's mounts): a user who
// deleted them all and comes back to the step keeps an empty list
let seeded = false;
</script>

<script setup lang="ts">
// Setup wizard, step "Catégories": the settings' « Catégories et groupes »
// table (CategoryManager), one kind at a time and without archiving. A user
// with no category nor group yet gets the suggested ones created on arrival,
// to edit (name, color, group) or delete like any other.
import { onMounted, ref } from 'vue';
import { api } from '@/api';
import { useFinanceData } from '@/composables/useFinanceData';
import { SUGGESTED_GROUPS } from '@/lib/suggestedCategories';
import CategoryManager from '../CategoryManager.vue';

const { categories, categoryGroups, refresh } = useFinanceData();

const seeding = ref(false);
const error = ref('');

onMounted(async () => {
  if (seeded || categories.value.length > 0 || categoryGroups.value.length > 0) return;
  seeded = true;
  seeding.value = true;
  try {
    // Groups one by one: each draws a color apart from the ones before. Their
    // categories take shades of it, so they can be created together.
    for (const g of SUGGESTED_GROUPS) {
      const group = await api.createCategoryGroup({ name: g.name });
      await Promise.all(g.categories.map((name) => api.createCategory({ name, kind: g.kind, group: group._id })));
    }
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    await refresh();
    seeding.value = false;
  }
});

// Called on "Suivant": everything is saved as it is edited
async function submit() {
  return true;
}
defineExpose({ submit });
</script>

<template>
  <div class="flex flex-col gap-4">
    <p v-if="seeding" class="text-sm text-muted-foreground">Préparation des catégories suggérées…</p>
    <CategoryManager
      v-else
      wizard
      :categories="categories"
      :groups="categoryGroups"
      @changed="refresh"
      @error="error = $event"
    />
    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
  </div>
</template>
