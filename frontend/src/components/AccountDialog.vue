<script setup lang="ts">
// Asks which account the file belongs to. The file name gives the account name
// and the bank, but not the account type, so the user picks the type here.
import type { Account, AccountType, ImportSummary, ParsedCsv } from '@/types';
import { computed, ref } from 'vue';
import { api, formatCents } from '@/api';
import { BANKS } from '@/lib/banks';
import { ACCOUNT_TYPES } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import OptionSelect from './OptionSelect.vue';
import ParseErrors from './ParseErrors.vue';

const props = defineProps<{ accounts: Account[]; result: ParsedCsv }>();
const emit = defineEmits<{ cancel: []; done: [account: Account, summary: ImportSummary] }>();

const name = ref(props.result.accountName);
const type = ref<AccountType>(findAccount(props.result.accountName)?.type ?? 'checking');
const saving = ref(false);
const error = ref('');

const existing = computed(() => findAccount(name.value, type.value));
const bank = computed(() => (props.result.bank ? BANKS[props.result.bank] : undefined));
const count = computed(() => props.result.transactions.length);

// Same bank and name (case-insensitive), and same type when given
function findAccount(accountName: string, accountType?: AccountType) {
  const wanted = accountName.trim().toLowerCase();
  return props.accounts.find(
    (a) =>
      (a.bank ?? null) === props.result.bank &&
      a.name.trim().toLowerCase() === wanted &&
      (accountType === undefined || a.type === accountType),
  );
}

function onOpenChange(open: boolean) {
  if (!open && !saving.value) emit('cancel');
}

async function submit() {
  saving.value = true;
  error.value = '';
  try {
    const account =
      existing.value ??
      (await api.createAccount({
        name: name.value.trim(),
        type: type.value,
        bank: props.result.bank ?? undefined,
      }));
    const summary = await api.importTransactions({
      account: account._id,
      transactions: props.result.transactions,
    });
    emit('done', account, summary);
  } catch (err) {
    error.value = (err as Error).message;
    saving.value = false;
  }
}
</script>

<template>
  <Dialog :open="true" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-3xl">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <DialogHeader class="flex-row items-center gap-3">
          <img v-if="bank" :src="bank.logo" :alt="bank.name" class="size-10 rounded-md" />
          <div class="flex flex-col gap-1">
            <DialogTitle>Dans quel compte importer ?</DialogTitle>
            <DialogDescription>
              {{ count }} transaction(s) lue(s){{
                result.errors.length > 0 ? `, ${result.errors.length} ligne(s) ignorée(s)` : ''
              }}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div class="flex flex-wrap gap-4">
          <div class="flex flex-1 flex-col gap-2">
            <Label for="import-account-name">Nom du compte</Label>
            <Input id="import-account-name" v-model="name" required />
          </div>
          <div class="flex flex-col gap-2">
            <Label>Type de compte</Label>
            <OptionSelect v-model="type" :options="ACCOUNT_TYPES" class="w-40" />
          </div>
        </div>

        <ParseErrors :errors="result.errors" />

        <div class="max-h-72 overflow-y-auto rounded-md border">
          <Table>
            <TableHeader class="sticky top-0 bg-background">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead class="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(t, i) in result.transactions" :key="i">
                <TableCell>{{ t.date }}</TableCell>
                <TableCell class="whitespace-normal">{{ t.description }}</TableCell>
                <TableCell
                  class="text-right tabular-nums"
                  :class="t.amountCents < 0 ? 'text-destructive' : 'text-emerald-600'"
                >
                  {{ formatCents(t.amountCents) }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <p class="text-sm text-muted-foreground">
          <template v-if="existing">
            Les {{ count }} transaction(s) seront ajoutées au compte existant.
          </template>
          <template v-else>
            Un nouveau compte{{ bank ? ` ${bank.name}` : '' }} sera créé avec {{ count }} transaction(s).
          </template>
        </p>

        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="saving" @click="emit('cancel')">
            Annuler
          </Button>
          <Button type="submit" :disabled="saving">{{ saving ? 'Import…' : 'Importer' }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
