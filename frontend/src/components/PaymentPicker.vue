<script setup lang="ts">
// Ticks payments among the transactions (a debt's usual payment, its
// additional ones): the money out of each account by description
// (lib/debts.ts paymentCandidates), searched, in a PickList - those ticked on
// top. v-model: the payments ticked, by account and description; one no
// transaction has any more stays ticked, said under the list. `single`: one
// payment at most, as radios (`clearable`: a link takes it off).
import type { PaymentMatch, Transaction } from '@/types';
import { computed, ref } from 'vue';
import { formatCents, formatDate } from '@/api';
import { type PaymentCandidate, candidateId, paymentCandidates } from '@/lib/debts';
import { matchesTransaction } from '@/lib/text';
import { Button } from '@/components/ui/button';
import AccountLogo from './AccountLogo.vue';
import PickList from './PickList.vue';
import PickOption from './PickOption.vue';
import SearchInput from './SearchInput.vue';

const model = defineModel<PaymentMatch[]>({ required: true });
const props = defineProps<{ transactions: Transaction[]; label: string; single?: boolean; clearable?: boolean }>();

// Payments listed at most, the search narrows them
const SHOWN = 50;

const search = ref('');
const candidates = computed(() => paymentCandidates(props.transactions));
const ticked = computed(() => new Set(model.value.map((m) => candidateId(m.account, m.description))));
const tickedCandidates = computed(() => candidates.value.filter((c) => ticked.value.has(c.id)));
const missing = computed(() =>
  model.value.filter((m) => !candidates.value.some((c) => c.id === candidateId(m.account, m.description))),
);

const shown = computed(() => {
  const list = candidates.value.filter((c) => matchesTransaction(c.latest, search.value));
  return [...tickedCandidates.value, ...list.slice(0, SHOWN).filter((c) => !ticked.value.has(c.id))];
});

// The one picked, in a single list: its candidate's id
const picked = computed({
  get: () => (model.value[0] ? candidateId(model.value[0].account, model.value[0].description) : null),
  set: (id: string | null) => {
    const c = candidates.value.find((c) => c.id === id);
    model.value = c ? [{ account: c.latest.account!._id, description: c.latest.description }] : [];
  },
});

function toggle(c: PaymentCandidate, on: boolean) {
  model.value = on
    ? [...model.value, { account: c.latest.account!._id, description: c.latest.description }]
    : model.value.filter((m) => candidateId(m.account, m.description) !== c.id);
}
</script>

<template>
  <div class="flex min-h-0 flex-col gap-2">
    <SearchInput v-model="search" label="Rechercher un paiement" placeholder="Rechercher un paiement" />
    <PickList
      v-if="single"
      v-model="picked"
      radio
      :label="label"
      :count="shown.length"
      empty="Aucune dépense ne correspond."
    >
      <PickOption v-for="c in shown" :key="c.id" :value="c.id">
        <AccountLogo :account="c.latest.account!" />
        <span class="flex min-w-0 flex-col">
          <span class="truncate font-medium">{{ c.latest.description }}</span>
          <span class="truncate text-muted-foreground">
            {{ c.count > 1 ? `${c.count} paiements · dernier le` : 'Le' }} {{ formatDate(c.latest.date) }}
          </span>
        </span>
        <template #end>{{ formatCents(-c.latest.amountCents) }}</template>
      </PickOption>
    </PickList>
    <PickList v-else :label="label" :count="shown.length" empty="Aucune dépense ne correspond.">
      <PickOption v-for="c in shown" :key="c.id" :checked="ticked.has(c.id)" @update:checked="toggle(c, !!$event)">
        <AccountLogo :account="c.latest.account!" />
        <span class="flex min-w-0 flex-col">
          <span class="truncate font-medium">{{ c.latest.description }}</span>
          <span class="truncate text-muted-foreground">
            {{ c.count > 1 ? `${c.count} paiements · dernier le` : 'Le' }} {{ formatDate(c.latest.date) }}
          </span>
        </span>
        <template #end>{{ formatCents(-c.latest.amountCents) }}</template>
      </PickOption>
    </PickList>
    <Button
      v-if="single && clearable && model.length > 0"
      type="button"
      variant="link"
      size="sm"
      class="h-auto self-start p-0 text-muted-foreground"
      @click="model = []"
    >
      Retirer la sélection
    </Button>
    <p v-if="missing.length > 0" class="text-sm text-muted-foreground">
      Aussi suivi{{ missing.length > 1 ? 's' : '' }}, sans transaction pour l'instant :
      {{ missing.map((m) => `« ${m.description} »`).join(', ') }}.
    </p>
  </div>
</template>
