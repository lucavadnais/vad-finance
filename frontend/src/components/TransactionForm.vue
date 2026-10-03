<script setup lang="ts">
import type { Account, Category, DuplicateMatch } from '@/types';
import { computed, ref } from 'vue';
import { Plus } from '@lucide/vue';
import { api, formatCents, formatDate, signedCents, toCents } from '@/api';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CategorySelect from './CategorySelect.vue';
import DatePicker from './DatePicker.vue';
import AccountSelect from './AccountSelect.vue';

const props = defineProps<{ accounts: Account[]; categories: Category[] }>();
const emit = defineEmits<{ created: []; error: [message: string] }>();

// 'transaction' = one account; 'transfer' = money moved between two own accounts
const mode = ref<'transaction' | 'transfer'>('transaction');

const account = ref(props.accounts[0]._id);
const toAccount = ref(props.accounts[1]?._id ?? '');
const category = ref<string | null>(null);
const date = ref(new Date().toISOString().slice(0, 10));
const description = ref('');
const amount = ref('');

const categoryKind = computed(() => props.categories.find((c) => c._id === category.value)?.kind);
const amountPlaceholder = computed(() =>
  categoryKind.value === 'expense'
    ? 'Montant de la dépense'
    : categoryKind.value === 'income'
      ? 'Montant du revenu'
      : 'Montant (négatif = dépense)',
);

// A similar transaction already saved: ask before adding (e.g. entered twice,
// or already imported from the statement)
interface Pending {
  save: () => Promise<unknown>;
  matches: { accountName: string; match: DuplicateMatch['match'] }[];
}
const pending = ref<Pending | null>(null);

const accountName = (id: string) => props.accounts.find((a) => a._id === id)?.name ?? '';

async function submit() {
  const amountCents = mode.value === 'transfer' ? toCents(amount.value) : signedCents(amount.value, categoryKind.value);
  if (Number.isNaN(amountCents)) {
    emit('error', 'Montant invalide');
    return;
  }
  if (mode.value === 'transfer' && amountCents <= 0) {
    emit('error', "Le montant d'un transfert doit être positif");
    return;
  }

  const base = { date: date.value, description: description.value };
  // Each side of the entry, in its account
  const sides =
    mode.value === 'transfer'
      ? [
          { account: account.value, amountCents: -amountCents },
          { account: toAccount.value, amountCents },
        ]
      : [{ account: account.value, amountCents }];
  const save = () =>
    mode.value === 'transfer'
      ? api.createTransfer({ ...base, from: account.value, to: toAccount.value, amountCents })
      : api.createTransaction({ ...base, account: account.value, category: category.value, amountCents });

  try {
    const found = await Promise.all(
      sides.map(async (side) => {
        const [m] = await api.checkDuplicates(side.account, [{ ...base, amountCents: side.amountCents }]);
        return m && { accountName: accountName(side.account), match: m.match };
      }),
    );
    const matches = found.filter((m) => !!m);
    if (matches.length > 0) {
      pending.value = { save, matches };
      return;
    }
    await finish(save);
  } catch (err) {
    emit('error', (err as Error).message);
  }
}

async function finish(save: () => Promise<unknown>) {
  pending.value = null;
  try {
    await save();
    description.value = '';
    amount.value = '';
    emit('created');
  } catch (err) {
    emit('error', (err as Error).message);
  }
}
</script>

<template>
  <!-- Fills the card: two columns once it is wide enough, one on narrow cards -->
  <form class="@container flex flex-col gap-4" @submit.prevent="submit">
    <Tabs v-model="mode">
      <TabsList class="w-full">
        <TabsTrigger value="transaction">Transaction</TabsTrigger>
        <TabsTrigger value="transfer" :disabled="accounts.length < 2">Transfert entre comptes</TabsTrigger>
      </TabsList>
    </Tabs>

    <div class="grid gap-4 @sm:grid-cols-2">
      <template v-if="mode === 'transaction'">
        <div class="flex flex-col gap-2">
          <Label for="manual-account">Compte</Label>
          <AccountSelect id="manual-account" v-model="account" :accounts="accounts" class="w-full" />
        </div>
      </template>
      <template v-else>
        <div class="flex flex-col gap-2">
          <Label for="manual-from">De</Label>
          <AccountSelect id="manual-from" v-model="account" :accounts="accounts" placeholder="De" class="w-full" />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="manual-to">Vers</Label>
          <AccountSelect
            id="manual-to"
            v-model="toAccount"
            :accounts="accounts.filter((a) => a._id !== account)"
            placeholder="Vers"
            class="w-full"
          />
        </div>
      </template>

      <div class="flex flex-col gap-2">
        <Label for="manual-date">Date</Label>
        <DatePicker id="manual-date" v-model="date" class="w-full" />
      </div>
      <div v-if="mode === 'transfer'" class="flex flex-col gap-2">
        <Label for="manual-amount">Montant</Label>
        <Input id="manual-amount" v-model="amount" inputmode="decimal" placeholder="0,00" required />
      </div>

      <div class="flex flex-col gap-2 @sm:col-span-2">
        <Label for="manual-description">Description</Label>
        <Input
          id="manual-description"
          v-model="description"
          :placeholder="mode === 'transfer' ? 'ex. paiement Visa' : 'ex. Épicerie IGA'"
        />
      </div>

      <template v-if="mode === 'transaction'">
        <div class="flex flex-col gap-2">
          <Label for="manual-category">Catégorie</Label>
          <CategorySelect id="manual-category" v-model="category" :categories="categories" class="w-full" />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="manual-amount">Montant</Label>
          <Input id="manual-amount" v-model="amount" inputmode="decimal" :placeholder="amountPlaceholder" required />
        </div>
      </template>
    </div>

    <p v-if="mode === 'transfer'" class="text-sm text-muted-foreground">
      Crée les deux côtés : le montant sort du premier compte et arrive dans le second. Ce n'est compté ni comme une
      dépense ni comme un revenu.
    </p>

    <Button type="submit" class="self-end">
      <Plus />
      {{ mode === 'transfer' ? 'Ajouter le transfert' : 'Ajouter la transaction' }}
    </Button>

    <AlertDialog :open="!!pending" @update:open="(open) => !open && (pending = null)">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Doublon possible</AlertDialogTitle>
          <AlertDialogDescription>
            Une transaction du même montant existe déjà à quelques jours près :
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul class="flex flex-col gap-2 text-sm">
          <li
            v-for="m in pending?.matches"
            :key="m.match._id"
            class="flex justify-between gap-4 rounded-md border px-3 py-2"
          >
            <span>
              <span class="font-medium">{{ m.accountName }}</span>
              <span class="text-muted-foreground"> · {{ formatDate(m.match.date) }} · {{ m.match.description }}</span>
            </span>
            <span class="tabular-nums">{{ formatCents(m.match.amountCents) }}</span>
          </li>
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <!-- A plain button: AlertDialogAction closes (and clears pending) before its click runs -->
          <Button @click="pending && finish(pending.save)">Ajouter quand même</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </form>
</template>
