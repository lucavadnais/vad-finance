<script setup lang="ts">
// Setup wizard, step "Budget": the money that comes back every month or so
// (pay, rent, subscriptions…) as projections, listed, added and edited as in
// "Gérer les prévisions", and the monthly buffer for unplanned spending,
// saved on "Suivant" (submit).
import type { Projection } from '@/types';
import { ref, watch } from 'vue';
import { Plus } from '@lucide/vue';
import { api, toCents } from '@/api';
import { useFinanceData } from '@/composables/useFinanceData';
import { Button } from '@/components/ui/button';
import BudgetBufferField from '../BudgetBufferField.vue';
import ProjectionDialog from '../ProjectionDialog.vue';
import ProjectionList from '../ProjectionList.vue';

const { projections, categories, settings, refresh } = useFinanceData();

const error = ref('');

// Dialog adding a projection, or editing `editing`
const dialogOpen = ref(false);
const editing = ref<Projection | null>(null);
function openDialog(p: Projection | null) {
  editing.value = p;
  dialogOpen.value = true;
}

async function remove(p: Projection) {
  error.value = '';
  try {
    await api.deleteProjection(p._id);
    await refresh();
  } catch (err) {
    error.value = (err as Error).message;
  }
}

const buffer = ref('');
watch(
  () => settings.value.budgetBufferCents,
  (cents) => (buffer.value = cents ? String(cents / 100).replace('.', ',') : ''),
  { immediate: true },
);

// Called on "Suivant": false keeps the wizard on this step
async function submit() {
  const cents = toCents(buffer.value || '0');
  if (Number.isNaN(cents) || cents < 0) {
    error.value = 'Marge invalide';
    return false;
  }
  if (cents === settings.value.budgetBufferCents) return true;
  error.value = '';
  try {
    settings.value = await api.updateSettings({ budgetBufferCents: cents });
    return true;
  } catch (err) {
    error.value = (err as Error).message;
    return false;
  }
}
defineExpose({ submit });
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div class="flex flex-col gap-1">
        <h3 class="font-medium">Revenus et dépenses prévus</h3>
      </div>
      <ProjectionList
        :projections="projections"
        :categories="categories"
        @add="openDialog(null)"
        @edit="openDialog"
        @remove="remove"
      >
        <template #actions>
          <!-- Icon only on a phone, so the search keeps its room. None yet:
               the empty list offers the first one itself -->
          <Button
            v-if="projections.length > 0"
            class="shrink-0 max-sm:size-9"
            aria-label="Ajouter une prévision"
            title="Ajouter une prévision"
            @click="openDialog(null)"
          >
            <Plus />
            <span class="max-sm:sr-only">Prévision</span>
          </Button>
        </template>
      </ProjectionList>
    </div>

    <div class="rounded-xl border bg-card p-4">
      <BudgetBufferField id="onboarding-buffer" v-model="buffer" />
    </div>

    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

    <ProjectionDialog
      v-model:open="dialogOpen"
      :categories="categories"
      :projection="editing"
      @saved="refresh"
      @remove="remove"
    />
  </div>
</template>
