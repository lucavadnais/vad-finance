<script setup lang="ts">
// "Budget" section of the settings: the monthly buffer for unplanned spending
import { computed, ref, watch } from 'vue';
import { api, toCents } from '@/api';
import { useFinanceData } from '@/composables/useFinanceData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const emit = defineEmits<{ error: [message: string] }>();

const { settings, refresh } = useFinanceData();

const amount = ref('');
// Follows the saved value (loaded after the dialog may have opened)
watch(
  () => settings.value.budgetBufferCents,
  (cents) => (amount.value = String(cents / 100).replace('.', ',')),
  { immediate: true },
);

const cents = computed(() => toCents(amount.value || '0'));
const changed = computed(() => cents.value !== settings.value.budgetBufferCents);
const saving = ref(false);

async function save() {
  if (Number.isNaN(cents.value) || cents.value < 0) {
    emit('error', 'Montant invalide');
    return;
  }
  saving.value = true;
  try {
    await api.updateSettings({ budgetBufferCents: cents.value });
    await refresh();
  } catch (err) {
    emit('error', (err as Error).message);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <!-- A section of the settings dialog -->
  <section class="flex flex-col gap-6">
    <header class="flex flex-col gap-1 pr-6">
      <h2 class="text-lg font-semibold">Budget</h2>
      <p class="text-sm text-muted-foreground">Comment vos dépenses réelles sont comparées à vos prévisions.</p>
    </header>

    <form class="flex max-w-lg flex-col gap-2" @submit.prevent="save">
      <Label for="budget-buffer">Marge mensuelle pour imprévus</Label>
      <div class="flex gap-2">
        <div class="relative w-40">
          <Input id="budget-buffer" v-model="amount" inputmode="decimal" class="pr-7 text-right" />
          <span class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
            >$</span
          >
        </div>
        <Button type="submit" :disabled="!changed || saving">{{ saving ? 'Enregistrement…' : 'Enregistrer' }}</Button>
      </div>
      <p class="text-sm text-muted-foreground">
        Mise de côté chaque mois pour les petites dépenses imprévues (un café, un lunch…). Elles ne comptent comme
        dépassement qu'une fois la marge épuisée.
      </p>
    </form>
  </section>
</template>
