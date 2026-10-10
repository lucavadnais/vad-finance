<script setup lang="ts">
// Deletes an account in two steps: choose what happens to its transactions
// (move them to another account, or delete them too), then confirm. An account
// without transactions goes straight to the confirmation.
import type { Account } from '@/types';
import { computed, ref, watch } from 'vue';
import { ArrowRightLeft, Trash2 } from '@lucide/vue';
import { api, formatCents } from '@/api';
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
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import AccountSelect from './AccountSelect.vue';

const open = defineModel<boolean>('open', { required: true });
const props = defineProps<{ account: Account; accounts: Account[] }>();
const emit = defineEmits<{ deleted: [] }>();

type Choice = 'move' | 'delete';

const step = ref<'choose' | 'confirm'>('choose');
const choice = ref<Choice>('move');
const targetId = ref<string>();
const moveInitialBalance = ref(true);
const busy = ref(false);
const error = ref('');

const count = computed(() => props.account.transactionCount);
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

// Amounts are not converted: only accounts in the same currency can take them
const targets = computed(() =>
  props.accounts.filter((a) => a._id !== props.account._id && a.currency === props.account.currency),
);
const target = computed(() => targets.value.find((a) => a._id === targetId.value));

// Every opening starts over
watch(open, (value) => {
  if (!value) return;
  step.value = count.value > 0 ? 'choose' : 'confirm';
  choice.value = targets.value.length > 0 ? 'move' : 'delete';
  targetId.value = targets.value.length === 1 ? targets.value[0]._id : undefined;
  moveInitialBalance.value = true;
  error.value = '';
});

const moving = computed(() => count.value > 0 && choice.value === 'move');
const canConfirm = computed(() => !busy.value && (!moving.value || !!target.value));

function onOpenChange(value: boolean) {
  if (!busy.value) open.value = value;
}

async function confirm() {
  busy.value = true;
  error.value = '';
  try {
    await api.deleteAccount(
      props.account._id,
      moving.value && target.value ? { to: target.value._id, initialBalance: moveInitialBalance.value } : undefined,
    );
    open.value = false;
    emit('deleted');
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Supprimer « {{ account.name }} »</DialogTitle>
        <DialogDescription v-if="count > 0">
          Étape {{ step === 'choose' ? 1 : 2 }} sur 2 — ce compte a {{ plural(count, 'transaction') }}.
        </DialogDescription>
        <DialogDescription v-else>Ce compte n'a aucune transaction.</DialogDescription>
      </DialogHeader>

      <DialogBody>
        <!-- Step 1: what happens to the transactions -->
        <RadioGroup v-if="step === 'choose'" v-model="choice" class="gap-3">
          <Label
            for="delete-move"
            class="flex cursor-pointer items-start gap-3 rounded-lg border p-4 font-normal has-[[data-state=checked]]:border-primary has-[[data-disabled]]:cursor-not-allowed has-[[data-disabled]]:opacity-50"
          >
            <RadioGroupItem id="delete-move" value="move" :disabled="targets.length === 0" class="mt-0.5" />
            <span class="flex flex-col gap-1">
              <span class="flex items-center gap-2 font-medium"
                ><ArrowRightLeft class="size-4" /> Transférer les transactions</span
              >
              <span class="text-sm text-muted-foreground">
                <template v-if="targets.length > 0">
                  Elles sont déplacées vers un autre compte, puis ce compte est supprimé. Utile pour fusionner deux
                  comptes.
                </template>
                <template v-else>Aucun autre compte en {{ account.currency }} pour les recevoir.</template>
              </span>
            </span>
          </Label>
          <Label
            for="delete-all"
            class="flex cursor-pointer items-start gap-3 rounded-lg border p-4 font-normal has-[[data-state=checked]]:border-destructive"
          >
            <RadioGroupItem id="delete-all" value="delete" class="mt-0.5" />
            <span class="flex flex-col gap-1">
              <span class="flex items-center gap-2 font-medium"
                ><Trash2 class="size-4" /> Supprimer les transactions</span
              >
              <span class="text-sm text-muted-foreground">
                Le compte et ses {{ plural(count, 'transaction') }} sont supprimés définitivement.
              </span>
            </span>
          </Label>
        </RadioGroup>

        <!-- Step 2, move: pick the account -->
        <template v-else-if="moving">
          <div class="flex flex-col gap-2">
            <Label for="delete-target">Transférer vers</Label>
            <AccountSelect id="delete-target" v-model="targetId" :accounts="targets" class="w-full" />
          </div>
          <div v-if="account.initialBalanceCents !== 0" class="flex items-start gap-2">
            <Checkbox id="delete-initial" v-model="moveInitialBalance" class="mt-0.5" />
            <Label for="delete-initial" class="flex-col items-start gap-1 font-normal">
              <span>
                Ajouter le solde initial ({{ formatCents(account.initialBalanceCents, account.currency) }}) à celui du
                compte de destination
              </span>
              <span class="text-muted-foreground">
                Garde le même total. Décochez si les deux comptes représentent le même compte bancaire.
              </span>
            </Label>
          </div>
          <ul class="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
            <li>
              Les transferts entre les deux comptes sont supprimés : une fois fusionnés, ils iraient du compte vers
              lui-même.
            </li>
            <li>Les transferts avec les autres comptes pointent vers le compte de destination.</li>
            <li>
              Si les deux comptes avaient les mêmes transactions, elles apparaîtront dans les doublons à vérifier.
            </li>
          </ul>
          <p v-if="target" class="text-sm">
            Nouveau solde de {{ target.name }} :
            <span class="font-medium tabular-nums">
              {{
                formatCents(
                  target.balanceCents + account.balanceCents - (moveInitialBalance ? 0 : account.initialBalanceCents),
                  account.currency,
                )
              }}
            </span>
          </p>
        </template>

        <!-- Step 2, delete (or an account without transactions) -->
        <template v-else>
          <p class="text-sm">
            <template v-if="count > 0">
              Le compte et ses <strong>{{ plural(count, 'transaction') }}</strong> seront supprimés. Les transferts vers
              d'autres comptes y resteront, comme des transactions ordinaires.
            </template>
            <template v-else>Le compte sera supprimé.</template>
            Cette action est irréversible.
          </p>
        </template>

        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
      </DialogBody>

      <DialogFooter>
        <Button
          v-if="step === 'confirm' && count > 0"
          variant="ghost"
          class="sm:mr-auto"
          :disabled="busy"
          @click="step = 'choose'"
        >
          Retour
        </Button>
        <Button variant="outline" :disabled="busy" @click="onOpenChange(false)">Annuler</Button>
        <Button v-if="step === 'choose'" @click="step = 'confirm'">Continuer</Button>
        <Button v-else :variant="moving ? 'default' : 'destructive'" :disabled="!canConfirm" @click="confirm">
          {{ busy ? 'Suppression…' : moving ? 'Transférer et supprimer' : 'Supprimer définitivement' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
