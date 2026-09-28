<script setup lang="ts">
import type { Account, Category, Transaction } from '@/types';
import { computed, ref } from 'vue';
import { ArrowLeft, ArrowRight, Check, Link2, Pencil, Trash2, Undo2, Unlink } from '@lucide/vue';
import { api, formatCents, formatDate, signedCents, toDateInput } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import CategorySelect, { TRANSFER } from './CategorySelect.vue';
import ConfirmDialog from './ConfirmDialog.vue';
import DatePicker from './DatePicker.vue';
import AccountSelect from './AccountSelect.vue';

const props = defineProps<{
  transaction: Transaction;
  accounts: Account[];
  categories: Category[];
}>();
const emit = defineEmits<{ changed: []; error: [message: string] }>();


const editing = ref(false);
const saving = ref(false);
const form = ref({
  account: '',
  category: null as string | null,
  transferAccount: undefined as string | undefined,
  date: '',
  description: '',
  amount: '',
});

const linked = computed(() => !!props.transaction.transferPeer);
// "Transfert" in the category select turns the transaction into a transfer
const isTransfer = computed(() => form.value.category === TRANSFER);
// Undefined for transfers and uncategorized: the typed sign is kept
const categoryKind = computed(() => props.categories.find((c) => c._id === form.value.category)?.kind);
const otherAccounts = computed(() => props.accounts.filter((a) => a._id !== form.value.account));

function startEdit() {
  const t = props.transaction;
  form.value = {
    account: t.account?._id ?? '',
    category: t.transferAccount ? TRANSFER : (t.category?._id ?? null),
    transferAccount: t.transferAccount?._id,
    date: toDateInput(t.date),
    description: t.description,
    // The category gives the sign, so only the magnitude is edited
    amount: ((t.category && !t.transferAccount ? Math.abs(t.amountCents) : t.amountCents) / 100).toFixed(2),
  };
  editing.value = true;
}

async function save() {
  const amountCents = signedCents(form.value.amount, categoryKind.value);
  if (Number.isNaN(amountCents)) {
    emit('error', 'Montant invalide');
    return;
  }
  if (isTransfer.value && !form.value.transferAccount) {
    emit('error', "Choisis l'autre compte du transfert");
    return;
  }
  saving.value = true;
  try {
    await api.updateTransaction(props.transaction._id, {
      account: form.value.account,
      // A transfer has no category
      category: isTransfer.value ? null : form.value.category,
      transferAccount: isTransfer.value ? (form.value.transferAccount ?? null) : null,
      date: form.value.date,
      description: form.value.description,
      amountCents,
    });
    editing.value = false;
    emit('changed');
  } catch (err) {
    emit('error', (err as Error).message);
  } finally {
    saving.value = false;
  }
}

async function unlink() {
  try {
    await api.unlinkTransfer(props.transaction._id);
    editing.value = false;
    emit('changed');
  } catch (err) {
    emit('error', (err as Error).message);
  }
}

async function remove() {
  try {
    await api.deleteTransaction(props.transaction._id);
    emit('changed');
  } catch (err) {
    emit('error', (err as Error).message);
  }
}
</script>

<template>
  <TableRow v-if="editing">
    <TableCell><DatePicker v-model="form.date" class="w-36" /></TableCell>
    <TableCell><AccountSelect v-model="form.account" :accounts="accounts" class="w-40" /></TableCell>
    <TableCell>
      <Input
        v-model="form.description"
        class="min-w-40"
        @keydown.enter="save"
        @keydown.esc="editing = false"
      />
    </TableCell>
    <TableCell class="space-y-2">
      <CategorySelect v-model="form.category" :categories="categories" allow-transfer class="w-36" />
      <template v-if="isTransfer">
        <!-- Linked transfers show their other side; unlink first to change it -->
        <div v-if="linked" class="flex items-center gap-1 text-xs text-muted-foreground">
          <Link2 class="size-3.5" />
          {{ transaction.transferAccount?.name }}
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Délier les deux côtés"
            title="Délier les deux côtés"
            @click="unlink"
          >
            <Unlink />
          </Button>
        </div>
        <AccountSelect
          v-else
          v-model="form.transferAccount"
          :accounts="otherAccounts"
          placeholder="Autre compte"
          class="w-36"
        />
      </template>
    </TableCell>
    <TableCell>
      <Input
        v-model="form.amount"
        class="w-28 text-right"
        @keydown.enter="save"
        @keydown.esc="editing = false"
      />
    </TableCell>
    <TableCell class="text-right">
      <Button size="icon-sm" :disabled="saving" aria-label="Enregistrer" @click="save">
        <Check />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        :disabled="saving"
        aria-label="Annuler"
        @click="editing = false"
      >
        <Undo2 />
      </Button>
    </TableCell>
  </TableRow>

  <TableRow v-else>
    <TableCell class="whitespace-nowrap">{{ formatDate(transaction.date) }}</TableCell>
    <TableCell>{{ transaction.account?.name }}</TableCell>
    <TableCell class="whitespace-normal">
      {{ transaction.description }}
      <div
        v-if="transaction.transferAccount"
        class="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"
        :title="linked ? 'Transfert lié à la transaction de l\'autre compte' : 'Transfert (autre côté non lié)'"
      >
        <component :is="transaction.amountCents < 0 ? ArrowRight : ArrowLeft" class="size-3.5" />
        {{ transaction.amountCents < 0 ? 'Vers' : 'De' }} {{ transaction.transferAccount.name }}
        <Link2 v-if="linked" class="size-3.5" />
      </div>
    </TableCell>
    <TableCell>
      <Badge v-if="transaction.transferAccount" variant="outline">Transfert</Badge>
      <Badge v-else-if="transaction.category" variant="outline">{{ transaction.category.name }}</Badge>
    </TableCell>
    <TableCell
      class="text-right tabular-nums"
      :class="transaction.amountCents < 0 ? 'text-destructive' : 'text-emerald-600'"
    >
      {{ formatCents(transaction.amountCents) }}
    </TableCell>
    <TableCell class="text-right">
      <Button size="icon-sm" variant="ghost" aria-label="Modifier" @click="startEdit">
        <Pencil />
      </Button>
      <ConfirmDialog title="Supprimer cette transaction ?" :description="transaction.description" @confirm="remove">
        <Button size="icon-sm" variant="ghost" aria-label="Supprimer">
          <Trash2 />
        </Button>
      </ConfirmDialog>
    </TableCell>
  </TableRow>
</template>
