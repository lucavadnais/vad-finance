<script setup lang="ts">
// Dialog that brings an account's balance to its real value (an investment's
// market value, as its platform shows it). The app only knows the money that
// went in and out: the gap is recorded as a gain or loss on that day, left out
// of the budget. The trigger is the default slot.
import type { Account } from '@/types';
import { computed, ref } from 'vue';
import { api, formatCents, toCents } from '@/api';
import { useAmountsHidden } from '@/composables/useAmountsHidden';
import { useFinanceData } from '@/composables/useFinanceData';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DatePicker from './DatePicker.vue';

const props = defineProps<{ account: Account }>();
const emit = defineEmits<{ changed: [] }>();

const { transactions } = useFinanceData();
const { amountsHidden } = useAmountsHidden();

const open = ref(false);
const date = ref('');
const value = ref('');
const saving = ref(false);
const error = ref('');

// Every opening starts from today
function onOpenChange(v: boolean) {
  if (saving.value) return;
  if (v) {
    date.value = new Date().toISOString().slice(0, 10);
    value.value = '';
    error.value = '';
  }
  open.value = v;
}

// The balance the app computes at the end of that day, as the backend does
const balanceCents = computed(() => {
  const end = new Date(`${date.value}T00:00:00Z`);
  return transactions.value
    .filter((t) => t.account?._id === props.account._id && new Date(t.date) <= end)
    .reduce((sum, t) => sum + t.amountCents, props.account.initialBalanceCents);
});
const valueCents = computed(() => toCents(value.value));
const gapCents = computed(() => (Number.isNaN(valueCents.value) ? 0 : valueCents.value - balanceCents.value));

// A value and a day: the button waits for both
const valid = computed(() => !Number.isNaN(valueCents.value) && !!date.value);

async function submit() {
  if (!valid.value) return;
  saving.value = true;
  error.value = '';
  try {
    await api.updateAccountValue(props.account._id, { date: date.value, valueCents: valueCents.value });
    open.value = false;
    emit('changed');
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogTrigger as-child>
      <slot />
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>Mettre à jour la valeur</DialogTitle>
          <DialogDescription> La valeur du compte telle que votre plateforme de courtage l'affiche. </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-2">
              <Label for="account-value-date">Date</Label>
              <DatePicker id="account-value-date" v-model="date" class="w-full" />
            </div>
            <div class="flex flex-col gap-2">
              <Label for="account-value">Valeur</Label>
              <Input id="account-value" v-model="value" inputmode="decimal" placeholder="0,00" required />
            </div>
          </div>
          <p class="text-sm text-muted-foreground">
            Solde calculé à cette date : {{ formatCents(balanceCents, account.currency) }}
            <template v-if="value && gapCents !== 0">
              <br />
              {{ gapCents > 0 ? 'Gain' : 'Perte' }} ajouté :
              <span class="font-medium" :class="gapCents < 0 ? 'text-destructive' : 'text-emerald-600'">
                {{ gapCents > 0 && !amountsHidden ? '+' : '' }}{{ formatCents(gapCents, account.currency) }}
              </span>
            </template>
          </p>

          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="saving" @click="onOpenChange(false)"> Annuler </Button>
          <Button type="submit" :disabled="saving || !valid">
            {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
