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
const emit = defineEmits<{ cancel: []; done: [account: Account, summary: ImportSummary] }>();

const accountId = ref<string | undefined>(props.accounts.length === 1 ? props.accounts[0]._id : undefined);
const account = computed(() => props.accounts.find((a) => a._id === accountId.value));

// Our category named like the bank's one, ignoring case and accents, of the
// row's kind (an expense and an income may share a name)
// Archived categories are not picked for new transactions
const nameKey = (kind: Category['kind'], name: string) => `${kind}:${normalizeText(name)}`;
const categoryByName = new Map(
  props.categories.filter((c) => !c.archived).map((c) => [nameKey(c.kind, c.name), c._id]),
);

// Editable copy of the parsed rows. `category` may be TRANSFER: the row is then
// a transfer to or from `transferAccount`
const rows = ref(
  props.result.transactions.map((t) => ({
    ...t,
    category:
      (t.bankCategory && categoryByName.get(nameKey(t.amountCents < 0 ? 'expense' : 'income', t.bankCategory))) || null,
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

// On the id, not the account: a refresh (a category created from a row) brings
// new account objects, and must not reset the checkboxes
watch(
  accountId,
  async (id) => {
    duplicates.value = new Map();
    selected.value = rows.value.map(() => true);
    if (!id) return;
    checking.value = true;
    try {
      const matches = await api.checkDuplicates(id, props.result.transactions);
      if (accountId.value !== id) return; // account changed meanwhile
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

// First import into the account (it may hold transfer sides the app created):
// its balance today, as the bank shows it, after the statement's last
// transaction. The server sets the initial balance so that the account ends up
// at that balance. Left empty, the initial balance stays as it is.
const firstImport = computed(
  () => !!account.value && account.value.transactionCount === account.value.autoCreatedCount,
);
const currentBalance = ref('');
// "Importer" was clicked with no balance: warned once, the next click imports
const balanceWarned = ref(false);
watch(accountId, () => {
  currentBalance.value = '';
  balanceWarned.value = false;
});
const currentCents = computed(() =>
  firstImport.value && currentBalance.value.trim() ? toCents(currentBalance.value) : null,
);
const exactCount = computed(() => [...duplicates.value.values()].filter((d) => d.kind === 'exact').length);
const possibleCount = computed(() => duplicates.value.size - exactCount.value);

function onOpenChange(open: boolean) {
  if (!open && !saving.value) emit('cancel');
}

const isTransfer = (r: { category: string | null }) => r.category === TRANSFER;
// The import waits for every transfer checked to have its other account, and
// for the balance typed (if any) to be a number
const valid = computed(
  () =>
    !rows.value.some(
      (r, i) => selected.value[i] && isTransfer(r) && (!r.transferAccount || r.transferAccount === accountId.value),
    ) && !Number.isNaN(currentCents.value),
);

async function submit() {
  if (!account.value || !valid.value) return;
  const chosen = rows.value.filter((_, i) => selected.value[i]);
  if (firstImport.value && currentCents.value === null && !balanceWarned.value) {
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
      currentBalanceCents: currentCents.value ?? undefined,
    });
    // Unchecked rows (duplicates left out) count as skipped
    const total = { ...summary, skipped: summary.skipped + count.value - selectedCount.value };
    emit('done', account.value, total);
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
          <Button type="submit" :disabled="!account || saving || checking || selectedCount === 0 || !valid">
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
