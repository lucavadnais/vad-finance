<script setup lang="ts">
// Puts money aside in `goal`: an amount, a day and an optional note. Nothing
// moves between the accounts: the goal only keeps that share of them. Never
// more than the free money (`freeCents`). Under the form, the goal's
// movements, newest first: deleting one is how money is taken back. Opened
// through v-model:open.
import type { SavingsGoal } from '@/types';
import { computed, ref, watch } from 'vue';
import { api, formatCents, toCents, todayInput } from '@/api';
import { useFinanceData } from '@/composables/useFinanceData';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DatePicker from './DatePicker.vue';
import HistoryList, { type HistoryItem } from './HistoryList.vue';

const open = defineModel<boolean>('open', { required: true });
const props = defineProps<{ goal: SavingsGoal | null; freeCents: number }>();
const { putGoal } = useFinanceData();

const amount = ref('');
const date = ref<string | undefined>();
const note = ref('');
const saving = ref(false);
const error = ref('');

// Every opening starts from an empty form, today
watch(open, (value) => {
  if (!value) return;
  amount.value = '';
  date.value = todayInput();
  note.value = '';
  error.value = '';
});

const maxCents = computed(() => Math.max(0, props.freeCents));
const cents = computed(() => toCents(amount.value));
// Over what is free: the line under the amount turns red
const overFree = computed(() => cents.value > maxCents.value);
// Every field valid: the button waits for it
const valid = computed(() => !Number.isNaN(cents.value) && cents.value > 0 && !overFree.value && !!date.value);
const history = computed<HistoryItem[]>(() =>
  [...(props.goal?.movements ?? [])]
    .sort((a, b) => b.date.localeCompare(a.date) || b._id.localeCompare(a._id))
    .map((m) => ({
      id: m._id,
      title: m.note || (m.amountCents > 0 ? 'Mis de côté' : 'Retiré'),
      date: m.date,
      amountCents: m.amountCents,
      positive: m.amountCents > 0,
    })),
);

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
  if (!valid.value) return;
  const body = { amountCents: cents.value, date: date.value!, note: note.value };
  return run(() => api.addSavingsMovement(props.goal!._id, body), true);
}

const remove = (id: string) => run(() => api.deleteSavingsMovement(props.goal!._id, id), false);
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent v-if="goal" class="sm:max-w-md">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>{{ goal.name }}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-2">
              <Label for="movement-amount">Montant</Label>
              <Input id="movement-amount" v-model="amount" inputmode="decimal" placeholder="0,00" required />
            </div>
            <div class="flex flex-col gap-2">
              <Label>Date</Label>
              <DatePicker v-model="date" class="w-full" />
            </div>
          </div>
          <p class="-mt-2 text-sm" :class="overFree ? 'text-destructive' : 'text-muted-foreground'">
            Encore disponible : {{ formatCents(maxCents) }}
          </p>
          <div class="flex flex-col gap-2">
            <Label for="movement-note">Note <span class="font-normal text-muted-foreground">(facultative)</span></Label>
            <Input id="movement-note" v-model="note" placeholder="Paie du 15" />
          </div>

          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

          <!-- The history: what made up what the goal holds (taken back, for
               older ones) -->
          <HistoryList :items="history" remove-label="Supprimer ce mouvement" :disabled="saving" @remove="remove" />
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="saving" @click="onOpenChange(false)">Annuler</Button>
          <Button type="submit" :disabled="saving || !valid">
            {{ saving ? 'Enregistrement…' : 'Mettre de côté' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
