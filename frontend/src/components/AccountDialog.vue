<script setup lang="ts">
// Import preview: pick the account the statement belongs to, review and edit
// each row (description, category), leave out duplicates, then import. The
// first import into an account (no transaction yet) asks for its current
// balance, from which its initial balance is worked out.
import type { Account, Category, DuplicateMatch, ImportSummary, ParsedCsv } from '@/types';
import { computed, ref, watch } from 'vue';
import { TriangleAlert } from '@lucide/vue';
import { api, formatCents, formatDate, toCents } from '@/api';
import { normalizeText } from '@/lib/text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AccountSelect from './AccountSelect.vue';
import CategorySelect, { TRANSFER } from './CategorySelect.vue';
import ParseErrors from './ParseErrors.vue';

const props = defineProps<{ accounts: Account[]; categories: Category[]; result: ParsedCsv }>();
// `warning`: imported, but something after it failed (the initial balance)
const emit = defineEmits<{ cancel: []; done: [account: Account, summary: ImportSummary, warning?: string] }>();

const accountId = ref<string | undefined>(props.accounts.length === 1 ? props.accounts[0]._id : undefined);
const account = computed(() => props.accounts.find((a) => a._id === accountId.value));

// Our category named like the bank's one, ignoring case and accents
// Archived categories are not picked for new transactions
const categoryByName = new Map(props.categories.filter((c) => !c.archived).map((c) => [normalizeText(c.name), c._id]));

// Editable copy of the parsed rows. `category` may be TRANSFER: the row is then
// a transfer to or from `transferAccount`
const rows = ref(
  props.result.transactions.map((t) => ({
    ...t,
    category: (t.bankCategory && categoryByName.get(normalizeText(t.bankCategory))) || null,
    transferAccount: undefined as string | undefined,
  })),
);

// The other accounts, for transfers
const otherAccounts = computed(() => props.accounts.filter((a) => a._id !== accountId.value));
const count = computed(() => rows.value.length);

const saving = ref(false);
const error = ref('');
// A validation message goes away as soon as the rows are edited
watch(rows, () => (error.value = ''), { deep: true });

// Rows that may already be in the chosen account. Exact ones (same day, label
// and amount) start unchecked; possible ones stay checked but flagged, since
// dropping a real transaction silently is worse than a visible duplicate.
const duplicates = ref(new Map<number, DuplicateMatch>());
const selected = ref<boolean[]>(rows.value.map(() => true));
const checking = ref(false);

watch(
  account,
  async (acc) => {
    duplicates.value = new Map();
    selected.value = rows.value.map(() => true);
    if (!acc) return;
    checking.value = true;
    try {
      const matches = await api.checkDuplicates(acc._id, props.result.transactions);
      if (account.value?._id !== acc._id) return; // account changed meanwhile
      duplicates.value = new Map(matches.map((m) => [m.index, m]));
      selected.value = rows.value.map((_, i) => duplicates.value.get(i)?.kind !== 'exact');
    } catch (err) {
      error.value = (err as Error).message;
    } finally {
      checking.value = false;
    }
  },
  { immediate: true },
);

const selectedCount = computed(() => selected.value.filter(Boolean).length);

// First import into the account: its balance today, as the bank shows it,
// after the statement's last transaction. Initial balance = that balance
// minus what is imported. Left empty, the initial balance stays as it is.
const firstImport = computed(() => account.value?.transactionCount === 0);
const currentBalance = ref('');
// "Importer" was clicked with no balance: warned once, the next click imports
const balanceWarned = ref(false);
watch(accountId, () => {
  currentBalance.value = '';
  balanceWarned.value = false;
});
const importedCents = computed(() =>
  rows.value.reduce((sum, r, i) => (selected.value[i] ? sum + r.amountCents : sum), 0),
);
const initialCents = computed(() => {
  if (!firstImport.value || !currentBalance.value.trim()) return null;
  const cents = toCents(currentBalance.value);
  return Number.isNaN(cents) ? NaN : cents - importedCents.value;
});
const exactCount = computed(() => [...duplicates.value.values()].filter((d) => d.kind === 'exact').length);
const possibleCount = computed(() => duplicates.value.size - exactCount.value);

function onOpenChange(open: boolean) {
  if (!open && !saving.value) emit('cancel');
}

async function submit() {
  if (!account.value) return;
  const chosen = rows.value.filter((_, i) => selected.value[i]);
  const isTransfer = (r: (typeof chosen)[number]) => r.category === TRANSFER;
  if (chosen.some((r) => isTransfer(r) && (!r.transferAccount || r.transferAccount === accountId.value))) {
    error.value = "Choisissez l'autre compte de chaque transfert";
    return;
  }
  if (Number.isNaN(initialCents.value)) {
    error.value = 'Solde invalide';
    return;
  }
  if (firstImport.value && initialCents.value === null && !balanceWarned.value) {
    balanceWarned.value = true;
    document.getElementById('import-current-balance')?.focus();
    return;
  }
  saving.value = true;
  error.value = '';
  try {
    const summary = await api.importTransactions({
      account: account.value._id,
      transactions: chosen.map((r) => ({
        date: r.date,
        description: r.description,
        amountCents: r.amountCents,
        category: isTransfer(r) ? null : r.category,
        transferAccount: isTransfer(r) ? r.transferAccount : null,
      })),
      // The duplicates were reviewed above: import exactly the checked rows
      allowDuplicates: true,
    });
    // Unchecked rows (duplicates left out) count as skipped
    const total = { ...summary, skipped: summary.skipped + count.value - selectedCount.value };
    // After the import, so a failed import changes nothing; the transactions
    // are in then, whatever happens here
    let warning: string | undefined;
    if (initialCents.value !== null) {
      const { name, type } = account.value;
      try {
        await api.updateAccount(account.value._id, { name, type, initialBalanceCents: initialCents.value });
      } catch (err) {
        warning = `Le solde initial n'a pas pu être enregistré : ${(err as Error).message}`;
      }
    }
    emit('done', account.value, total, warning);
  } catch (err) {
    error.value = (err as Error).message;
    saving.value = false;
  }
}
</script>

<template>
  <Dialog :open="true" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-5xl">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>Importer le relevé</DialogTitle>
          <DialogDescription>
            {{ count }} transaction(s) lue(s){{
              result.errors.length > 0 ? `, ${result.errors.length} ligne(s) ignorée(s)` : ''
            }}. Choisissez le compte, puis ajustez les descriptions et les catégories au besoin.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div class="flex flex-col gap-2">
            <Label for="import-account">Compte</Label>
            <p v-if="accounts.length === 0" class="text-sm text-destructive">
              Aucun compte : créez d'abord le compte dans la carte Comptes.
            </p>
            <AccountSelect v-else id="import-account" v-model="accountId" :accounts="accounts" class="w-72" />
          </div>

          <ParseErrors :errors="result.errors" />

          <div class="min-h-40 shrink overflow-y-auto rounded-md border">
            <Table>
              <TableHeader class="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead class="w-8" />
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead class="text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="(t, i) in rows" :key="i" :class="!selected[i] && 'opacity-50'">
                  <TableCell>
                    <Checkbox v-model="selected[i]" :aria-label="`Importer ${t.description}`" />
                  </TableCell>
                  <TableCell class="whitespace-nowrap">{{ t.date }}</TableCell>
                  <TableCell class="min-w-64 whitespace-normal">
                    <Input v-model="t.description" :aria-label="`Description du ${t.date}`" class="h-8" />
                    <div v-if="duplicates.get(i)" class="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <Badge :variant="duplicates.get(i)!.kind === 'exact' ? 'secondary' : 'outline'">
                        {{ duplicates.get(i)!.kind === 'exact' ? 'Déjà présente' : 'Doublon possible' }}
                      </Badge>
                      <span class="text-muted-foreground">
                        {{ formatDate(duplicates.get(i)!.match.date) }} · {{ duplicates.get(i)!.match.description }}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell class="space-y-1.5">
                    <CategorySelect
                      v-model="t.category"
                      :categories="categories"
                      :allow-transfer="accounts.length > 1"
                      :new-kind="t.amountCents < 0 ? 'expense' : 'income'"
                      class="h-8 w-44"
                    />
                    <AccountSelect
                      v-if="t.category === TRANSFER"
                      v-model="t.transferAccount"
                      :accounts="otherAccounts"
                      :placeholder="t.amountCents < 0 ? 'Vers le compte' : 'Du compte'"
                      class="h-8 w-44"
                    />
                  </TableCell>
                  <TableCell
                    class="text-right whitespace-nowrap tabular-nums"
                    :class="t.amountCents < 0 ? 'text-destructive' : 'text-emerald-600'"
                  >
                    {{ formatCents(t.amountCents) }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <!-- First import into the account: its balance, set apart under the rows -->
          <section v-if="firstImport && account" class="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4">
            <Label for="import-current-balance" class="font-medium">Solde du compte aujourd'hui</Label>
            <p class="text-sm text-muted-foreground">
              C'est votre premier import dans « {{ account.name }} ». Entrez le solde que vous voyez en ce moment dans
              votre appli bancaire.
            </p>
            <Input
              id="import-current-balance"
              v-model="currentBalance"
              inputmode="decimal"
              placeholder="0,00"
              class="w-48"
            />
            <p v-if="initialCents !== null && !Number.isNaN(initialCents)" class="text-sm text-muted-foreground">
              Solde avant ces transactions : {{ formatCents(initialCents, account.currency) }}
            </p>
            <!-- After "Importer" with nothing entered: a second click imports anyway -->
            <div
              v-if="balanceWarned && !currentBalance.trim()"
              role="alert"
              class="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
            >
              <TriangleAlert class="mt-0.5 size-4 shrink-0" />
              <span>
                Sans solde, le compte partira de 0 $ et ne correspondra pas à votre banque. Vous pourrez le corriger
                plus tard dans la fiche du compte.
              </span>
            </div>
          </section>

          <p class="text-sm text-muted-foreground">
            <template v-if="!account">Choisissez le compte pour vérifier les doublons.</template>
            <template v-else-if="checking">Recherche des doublons…</template>
            <template v-else>
              {{ selectedCount }} transaction(s) sur {{ count }} seront ajoutées à « {{ account.name }} ».
              <template v-if="exactCount > 0"> {{ exactCount }} déjà présente(s), décochée(s). </template>
              <template v-if="possibleCount > 0">
                {{ possibleCount }} doublon(s) possible(s) à vérifier : décochez celles déjà saisies.
              </template>
            </template>
          </p>

          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="saving" @click="emit('cancel')"> Annuler </Button>
          <Button type="submit" :disabled="!account || saving || checking || selectedCount === 0">
            {{
              saving
                ? 'Import…'
                : balanceWarned && firstImport && !currentBalance.trim()
                  ? 'Importer quand même'
                  : 'Importer'
            }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
