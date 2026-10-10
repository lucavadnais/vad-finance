<script setup lang="ts">
// Popup editing a saved transaction: account, date, description, category (or
// transfer) and amount
import type { Account, Category, Transaction } from '@/types';
import { computed, ref, watch } from 'vue';
import { Link2, Unlink } from '@lucide/vue';
import { api, signedCents, toDateInput } from '@/api';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AccountSelect from './AccountSelect.vue';
import CategorySelect, { TRANSFER } from './CategorySelect.vue';
import DatePicker from './DatePicker.vue';

const open = defineModel<boolean>('open', { required: true });
const props = defineProps<{
  transaction: Transaction | null;
  accounts: Account[];
  categories: Category[];
}>();
const emit = defineEmits<{ changed: [] }>();

const saving = ref(false);
const error = ref('');
const form = ref({
  account: '',
  category: null as string | null,
  transferAccount: undefined as string | undefined,
  date: '',
  description: '',
  amount: '',
});

const linked = computed(() => !!props.transaction?.transferPeer);
// "Transfert" in the category select turns the transaction into a transfer
const isTransfer = computed(() => form.value.category === TRANSFER);
// Undefined for transfers and uncategorized: the typed sign is kept
const categoryKind = computed(() => props.categories.find((c) => c._id === form.value.category)?.kind);
const otherAccounts = computed(() => props.accounts.filter((a) => a._id !== form.value.account));

// Every opening starts from the transaction
watch(open, (value) => {
  const t = props.transaction;
  if (!value || !t) return;
  form.value = {
    account: t.account?._id ?? '',
    category: t.transferAccount ? TRANSFER : (t.category?._id ?? null),
    transferAccount: t.transferAccount?._id,
    date: toDateInput(t.date),
    description: t.description,
    // The category gives the sign, so only the magnitude is edited
    amount: ((t.category && !t.transferAccount ? Math.abs(t.amountCents) : t.amountCents) / 100).toFixed(2),
  };
  error.value = '';
});

function onOpenChange(value: boolean) {
  if (!saving.value) open.value = value;
}

async function run(action: () => Promise<unknown>) {
  saving.value = true;
  error.value = '';
  try {
    await action();
    open.value = false;
    emit('changed');
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    saving.value = false;
  }
}

function save() {
  const t = props.transaction;
  if (!t) return;
  const amountCents = signedCents(form.value.amount, categoryKind.value);
  if (Number.isNaN(amountCents)) {
    error.value = 'Montant invalide';
    return;
  }
  if (isTransfer.value && !form.value.transferAccount) {
    error.value = "Choisissez l'autre compte du transfert";
    return;
  }
  run(() =>
    api.updateTransaction(t._id, {
      account: form.value.account,
      // A transfer has no category
      category: isTransfer.value ? null : form.value.category,
      transferAccount: isTransfer.value ? (form.value.transferAccount ?? null) : null,
      date: form.value.date,
      description: form.value.description,
      amountCents,
    }),
  );
}

function unlink() {
  const t = props.transaction;
  if (t) run(() => api.unlinkTransfer(t._id));
}
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-md">
      <form class="flex flex-col gap-4" @submit.prevent="save">
        <DialogHeader>
          <DialogTitle>Modifier la transaction</DialogTitle>
          <DialogDescription>
            Avec une catégorie, son type donne le signe : saisissez le montant sans signe.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-2">
              <Label for="transaction-account">Compte</Label>
              <AccountSelect id="transaction-account" v-model="form.account" :accounts="accounts" class="w-full" />
            </div>
            <div class="flex flex-col gap-2">
              <Label for="transaction-date">Date</Label>
              <DatePicker id="transaction-date" v-model="form.date" class="w-full" />
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <Label for="transaction-description">Description</Label>
            <Input id="transaction-description" v-model="form.description" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-2">
              <Label for="transaction-category">Catégorie</Label>
              <CategorySelect
                id="transaction-category"
                v-model="form.category"
                :categories="categories"
                allow-transfer
                class="w-full"
              />
            </div>
            <div class="flex flex-col gap-2">
              <Label for="transaction-amount">Montant</Label>
              <Input id="transaction-amount" v-model="form.amount" inputmode="decimal" class="text-right" />
            </div>
          </div>
          <template v-if="isTransfer">
            <!-- Linked transfers show their other side; unlink first to change it -->
            <div v-if="linked" class="flex items-center gap-2 text-sm text-muted-foreground">
              <Link2 class="size-4" />
              Lié à la transaction de {{ transaction?.transferAccount?.name }}
              <Button type="button" size="sm" variant="ghost" :disabled="saving" @click="unlink">
                <Unlink />
                Délier
              </Button>
            </div>
            <div v-else class="flex flex-col gap-2">
              <Label for="transaction-transfer">Autre compte du transfert</Label>
              <AccountSelect
                id="transaction-transfer"
                v-model="form.transferAccount"
                :accounts="otherAccounts"
                placeholder="Autre compte"
                class="w-full"
              />
            </div>
          </template>

          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="saving" @click="onOpenChange(false)">Annuler</Button>
          <Button type="submit" :disabled="saving">{{ saving ? 'Enregistrement…' : 'Enregistrer' }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
