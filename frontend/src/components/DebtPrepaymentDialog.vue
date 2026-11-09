<script setup lang="ts">
// A debt's prepayment: a large amount put on it once (before a renewal...),
// picked among the transactions (the money out of the accounts, those not
// already counted on the debt), searched, in a PickList. It lowers the
// balance like the payments (lib/debts.ts), not the pace. Under it, the
// prepayments so far, newest first, each to remove. Opened through
// v-model:open.
import type { SavingsGoal, Transaction } from '@/types';
import { computed, ref, watch } from 'vue';
import { api, formatCents, formatDate } from '@/api';
import { debtPayments } from '@/lib/debts';
import { useFinanceData } from '@/composables/useFinanceData';
import { matchesTransaction } from '@/lib/text';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import AccountLogo from './AccountLogo.vue';
import HistoryList, { type HistoryItem } from './HistoryList.vue';
import PickList from './PickList.vue';
import PickOption from './PickOption.vue';
import SearchInput from './SearchInput.vue';

const open = defineModel<boolean>('open', { required: true });
const props = defineProps<{ goal: SavingsGoal | null; transactions: Transaction[] }>();
const { putGoal } = useFinanceData();

// Transactions listed at most, the search narrows them
const SHOWN = 50;

const search = ref('');
const picked = ref<string | null>(null);
const saving = ref(false);
const error = ref('');

watch(open, (value) => {
  if (!value) return;
  search.value = '';
  picked.value = null;
  error.value = '';
});

// The money out of the accounts, newest first, but what the debt counts already
const shown = computed(() => {
  if (!props.goal) return [];
  const counted = new Set(debtPayments(props.goal, props.transactions).map((t) => t._id));
  return props.transactions
    .filter((t) => t.amountCents < 0 && !t.valuation && t.account && !counted.has(t._id))
    .filter((t) => matchesTransaction(t, search.value))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, SHOWN);
});

const history = computed<HistoryItem[]>(() => {
  const ids = new Set(props.goal?.prepayments ?? []);
  return props.transactions
    .filter((t) => ids.has(t._id))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => ({ id: t._id, title: t.description, date: t.date, amountCents: -t.amountCents }));
});

function onOpenChange(value: boolean) {
  if (!saving.value) open.value = value;
}

// The goal the API returns goes straight into the shared list: the history
// and the tiles follow at once
async function run(action: () => Promise<SavingsGoal>, close: boolean) {
  saving.value = true;
  error.value = '';
  try {
    putGoal(await action());
    if (close) open.value = false;
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    saving.value = false;
  }
}

function submit() {
  const id = picked.value;
  if (id) return run(() => api.addPrepayment(props.goal!._id, id), true);
}

const remove = (id: string) => run(() => api.removePrepayment(props.goal!._id, id), false);
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent v-if="goal" class="sm:max-w-lg">
      <form class="flex min-h-0 flex-col gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>Paiement anticipé · {{ goal.name }}</DialogTitle>
          <DialogDescription>
            Un montant versé une fois sur la dette, par exemple avant un renouvellement : choisissez sa transaction.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <SearchInput v-model="search" label="Rechercher une transaction" placeholder="Rechercher une transaction" />
          <PickList
            v-model="picked"
            radio
            label="Transaction du paiement anticipé"
            :count="shown.length"
            empty="Aucune dépense ne correspond."
          >
            <PickOption v-for="t in shown" :key="t._id" :value="t._id">
              <AccountLogo :account="t.account!" />
              <span class="flex min-w-0 flex-col">
                <span class="truncate font-medium">{{ t.description }}</span>
                <span class="truncate text-muted-foreground">{{ formatDate(t.date) }}</span>
              </span>
              <template #end>{{ formatCents(-t.amountCents) }}</template>
            </PickOption>
          </PickList>

          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

          <HistoryList
            :items="history"
            remove-label="Retirer ce paiement anticipé"
            :disabled="saving"
            @remove="remove"
          />
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="saving" @click="onOpenChange(false)">Annuler</Button>
          <Button type="submit" :disabled="saving || !picked">
            {{ saving ? 'Enregistrement…' : 'Ajouter le paiement' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
