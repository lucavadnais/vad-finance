<script setup lang="ts">
// "Compte dédié" field of a savings goal, set apart by a divider: an account
// whose balance the goal then follows (its id), none (null: money is put
// aside from the app, and can then be left out of the total,
// v-model:hidden-from-total), or not picked yet (undefined: a new goal
// preselects nothing). `description` goes between its label and the list,
// the default slot under it. `untitled`: in a step already titled so (the
// fund's wizard on a phone), no divider and its label for screen readers only. Changing the account of `goal` empties what
// was put aside in it: a warning says so.
import type { Account, SavingsGoal } from '@/types';
import { computed } from 'vue';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import AccountSelect, { NO_ACCOUNT } from './AccountSelect.vue';
import HiddenFromTotalField from './HiddenFromTotalField.vue';

const model = defineModel<string | null | undefined>({ required: true });
const hiddenFromTotal = defineModel<boolean>('hiddenFromTotal', { required: true });
const props = defineProps<{
  id: string;
  accounts: Account[];
  goal?: SavingsGoal | null;
  description?: string;
  untitled?: boolean;
}>();

// The list cannot hold an empty value: none is NO_ACCOUNT there, not picked ''
const selected = computed({
  get: () => (model.value === undefined ? '' : (model.value ?? NO_ACCOUNT)),
  set: (value: string) => (model.value = value === NO_ACCOUNT ? null : value),
});

const dropsMovements = computed(() => !!props.goal?.movements.length && model.value !== (props.goal.account ?? null));
</script>

<template>
  <div class="flex flex-col gap-2">
    <Separator v-if="!untitled" class="mb-2" />
    <Label :for="id" :class="untitled && 'sr-only'">Compte dédié</Label>
    <p v-if="description" class="text-sm text-muted-foreground">{{ description }}</p>
    <AccountSelect
      :id="id"
      v-model="selected"
      :accounts="accounts"
      none-label="Aucun compte"
      class="w-full bg-background"
    />
    <slot />
    <p v-if="dropsMovements" class="text-sm text-amber-600">
      En enregistrant, ce que vous avez mis de côté depuis l'app sera effacé : l'objectif repartira de zéro.
    </p>
    <!-- Saved in the app only: an account has its own option -->
    <HiddenFromTotalField v-if="model === null" :id="`${id}-hidden`" v-model="hiddenFromTotal" class="mt-2" />
  </div>
</template>
