<script setup lang="ts">
// Setup wizard, step "Catégories": the settings' « Catégories et groupes »
// table (CategoryManager), one kind at a time and without archiving. Spending
// categories but no income one: "Suivant" asks first, kindly, whether one was
// forgotten.
import type { CategoryKind } from '@/types';
import { ref, watch } from 'vue';
import { useFinanceData } from '@/composables/useFinanceData';
import CategoryManager from '../CategoryManager.vue';
import ConfirmDialog from '../ConfirmDialog.vue';

const { categories, categoryGroups, refresh } = useFinanceData();

const error = ref('');
const kind = ref<CategoryKind>('expense');

// The question about income, and how it was answered: going on, or not
const askIncome = ref(false);
let answer: ((goOn: boolean) => void) | null = null;
function answered(goOn: boolean) {
  answer?.(goOn);
  answer = null;
}
// Closed some other way (Escape): staying on the step
watch(askIncome, (open) => {
  if (!open) answered(false);
});
// Adding one: on the income side
function addIncome() {
  kind.value = 'income';
  answered(false);
}

// Called on "Suivant": everything is saved as it is edited
async function submit() {
  const has = (k: CategoryKind) => categories.value.some((c) => c.kind === k);
  if (!has('expense') || has('income')) return true;
  askIncome.value = true;
  return new Promise<boolean>((resolve) => (answer = resolve));
}
defineExpose({ submit });
</script>

<template>
  <div class="flex flex-col gap-4">
    <CategoryManager
      v-model:kind="kind"
      wizard
      :categories="categories"
      :groups="categoryGroups"
      @changed="refresh"
      @error="error = $event"
    />
    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
    <ConfirmDialog
      v-model:open="askIncome"
      title="Aucun revenu ?"
      description="On ne juge pas, on vérifie juste que vous n'avez rien oublié 😉"
      cancel-label="Ajouter un revenu"
      confirm-label="Continuer quand même"
      :destructive="false"
      @cancel="addIncome"
      @confirm="answered(true)"
    />
  </div>
</template>
