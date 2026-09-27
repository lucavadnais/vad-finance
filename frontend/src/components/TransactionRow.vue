<script setup lang="ts">
import type { Account, Category, Transaction } from '@/types';
import { computed, ref } from 'vue';
import { Check, Pencil, Trash2, Undo2 } from '@lucide/vue';
import { api, formatCents, formatDate, toCents, toDateInput } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import CategorySelect from './CategorySelect.vue';
import ConfirmDialog from './ConfirmDialog.vue';
import DatePicker from './DatePicker.vue';
import OptionSelect from './OptionSelect.vue';

const props = defineProps<{
  transaction: Transaction;
  accounts: Account[];
  categories: Category[];
}>();
const emit = defineEmits<{ changed: []; error: [message: string] }>();

const accountOptions = computed(() => Object.fromEntries(props.accounts.map((a) => [a._id, a.name])));

const editing = ref(false);
const saving = ref(false);
const form = ref({
  account: '',
  category: null as string | null,
  date: '',
  description: '',
  amount: '',
});

function startEdit() {
  const t = props.transaction;
  form.value = {
    account: t.account?._id ?? '',
    category: t.category?._id ?? null,
    date: toDateInput(t.date),
    description: t.description,
    amount: (t.amountCents / 100).toFixed(2),
  };
  editing.value = true;
}

async function save() {
  const amountCents = toCents(form.value.amount);
  if (Number.isNaN(amountCents)) {
    emit('error', 'Montant invalide');
    return;
  }
  saving.value = true;
  try {
    await api.updateTransaction(props.transaction._id, {
      account: form.value.account,
      category: form.value.category,
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
    <TableCell><OptionSelect v-model="form.account" :options="accountOptions" class="w-36" /></TableCell>
    <TableCell>
      <Input
        v-model="form.description"
        class="min-w-40"
        @keydown.enter="save"
        @keydown.esc="editing = false"
      />
    </TableCell>
    <TableCell><CategorySelect v-model="form.category" :categories="categories" class="w-36" /></TableCell>
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
    <TableCell class="whitespace-normal">{{ transaction.description }}</TableCell>
    <TableCell>
      <Badge v-if="transaction.category" variant="outline">{{ transaction.category.name }}</Badge>
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
