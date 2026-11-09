<script setup lang="ts">
// Adds a goal, or edits `goal`, as a wizard like the emergency fund's "Votre
// cible" (WizardFrame): first what to follow, then its steps.
// - Savings: its name, the amount to reach, an optional date, and an optional
//   account whose balance it then follows.
// - A debt to pay off (student loan, mortgage...): its name and its usual
//   payment, ticked among the transactions (each new one with the same
//   account and description lowers it by itself, lib/debts.ts); then, in a
//   step of their own, any additional payment, picked among them too, at
//   the usual payment's rhythm, and how many are still planned (counted in
//   the end foreseen for that many); then what was left
//   to pay on a day and its interest rates by period (a first one, then one
//   per change: a renewal, a variable rate). Prepayments are added from the
//   debt's tile (DebtPrepaymentDialog).
// Editing skips the first step: a goal keeps its kind. Opened through
// v-model:open.
import type {
  Account,
  DebtInput,
  ExtraRecurrence,
  PaymentMatch,
  SavingsGoal,
  SavingsGoalInput,
  Transaction,
} from '@/types';
import { computed, ref, watch } from 'vue';
import { Landmark, PiggyBank, Plus, X } from '@lucide/vue';
import { api, centsInput, formatDate, noMinus, toCents, toDateInput, todayInput } from '@/api';
import { extraPlan, paceLabel, usualPace } from '@/lib/debts';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import DatePicker from './DatePicker.vue';
import DedicatedAccountField from './DedicatedAccountField.vue';
import PaymentPicker from './PaymentPicker.vue';
import StepTitle from './StepTitle.vue';
import WizardFrame from './WizardFrame.vue';
import { CHOICE_CARD } from './WizardSteps.vue';

const open = defineModel<boolean>('open', { required: true });
const props = defineProps<{ goal: SavingsGoal | null; accounts: Account[]; transactions: Transaction[] }>();
const emit = defineEmits<{ saved: [] }>();

// ---- The form, from the goal at each opening

// Picked in the first step; none until then
const kind = ref<'savings' | 'debt' | null>(null);
const name = ref('');
// Savings
const target = ref('');
// The switch, as its label, turns the date on; off, the date is kept for when
// it is turned back on ('YYYY-MM-DD')
const hasDue = ref(false);
const dueDate = ref<string | undefined>();
// The account followed, or null: the goal holds what is put aside in it.
// Undefined until picked: a new goal preselects nothing
const account = ref<string | null | undefined>();
// Without an account: what it holds left out of the total of the accounts
const hiddenFromTotal = ref(false);
// Debt: the usual payment's transactions; the additional payments', how
// often they come back (kept as is: like the usual payment unless set
// elsewhere) and how many are still planned (typed as text, empty = until
// the end)
const paymentMatches = ref<PaymentMatch[]>([]);
const extraMatches = ref<PaymentMatch[]>([]);
const extraRecurrence = ref<ExtraRecurrence | null>(null);
// A number field: Vue gives it back as a number once typed, '' when empty
const extraCount = ref<string | number>('');
const parsedExtraCount = computed(() => (String(extraCount.value).trim() === '' ? null : Number(extraCount.value)));
// The day the last additional payment is planned, from the number typed in:
// that many periods (the usual payment's) after the last additional payment,
// or without any yet, after the last usual one (today without either). Null
// without a number; 'none' at 0.
const extraEnd = computed(() => {
  const count = parsedExtraCount.value;
  if (count === null || !Number.isInteger(count) || count < 0) return null;
  if (count === 0) return 'none';
  const pace = usualPace(paymentMatches.value, props.transactions);
  const plan = extraPlan(
    {
      extraMatches: extraMatches.value,
      extraRecurrence: extraRecurrence.value,
      extraCount: null,
      extraCountFrom: null,
    },
    props.transactions,
    pace.intervalDays,
  );
  const fromMs = plan?.lastMs ?? pace.lastMs ?? Date.now();
  const periodDays = plan?.periodDays ?? pace.intervalDays;
  return {
    date: new Date(fromMs + count * periodDays * 86_400_000).toISOString(),
    pace: paceLabel(periodDays),
    amountCents: plan?.amountCents ?? null,
  };
});

const balance = ref('');
// The amount borrowed, optional (typed as text, empty = worked out)
const loan = ref('');
const balanceDate = ref<string | undefined>();
// The rates, the first from the start (no day); typed as text ('4,89')
const rates = ref<{ rate: string; from: string | undefined }[]>([]);
const saving = ref(false);
const error = ref('');

watch(open, (value) => {
  if (!value) return;
  const g = props.goal;
  // A goal saved before debts existed has no kind: a savings goal
  kind.value = g ? (g.kind ?? 'savings') : null;
  name.value = g?.name ?? '';
  target.value = g?.targetCents ? centsInput(g.targetCents) : '';
  hasDue.value = !!g?.dueDate;
  dueDate.value = g?.dueDate ? toDateInput(g.dueDate) : undefined;
  account.value = g ? g.account : undefined;
  hiddenFromTotal.value = g?.hiddenFromTotal ?? false;
  paymentMatches.value = [...(g?.paymentMatches ?? [])];
  extraMatches.value = [...(g?.extraMatches ?? [])];
  extraRecurrence.value = g?.extraRecurrence ?? null;
  // How many are planned from now: those come since the number was typed
  // count already
  const saved =
    g && g.extraCount !== null
      ? (extraPlan(g, props.transactions, usualPace(g.paymentMatches, props.transactions).intervalDays)?.remaining ??
        g.extraCount)
      : null;
  extraCount.value = saved === null ? '' : String(saved);
  balance.value = g?.debtStartCents ? centsInput(g.debtStartCents) : '';
  loan.value = g?.loanCents ? centsInput(g.loanCents) : '';
  balanceDate.value = g?.debtStartDate ? toDateInput(g.debtStartDate) : todayInput();
  rates.value = g?.interestRates.length
    ? g.interestRates.map((r) => ({
        rate: String(r.ratePercent).replace('.', ','),
        from: r.from ? toDateInput(r.from) : undefined,
      }))
    : [{ rate: '', from: undefined }];
  stepIndex.value = 0;
  error.value = '';
});

// Savings turned to a date without one yet: a year from now
watch(hasDue, (on) => {
  if (!on || dueDate.value) return;
  dueDate.value = todayInput(1);
});

// ---- The wizard

type Step = 'kind' | 'details' | 'payment' | 'extras' | 'balance';
// The step's title on top, none for the payment: under the debt's name
const TITLES: Record<Step, string | undefined> = {
  kind: 'Que voulez-vous suivre ?',
  details: 'Votre projet',
  payment: undefined,
  extras: 'Paiements additionnels (Facultatif)',
  balance: 'Solde et taux',
};
// Under some titles, what to do
const DESCRIPTIONS: Partial<Record<Step, string>> = {
  extras: 'Choisissez le paiement que vous ajoutez au paiement habituel : il réduit le solde.',
};
const SHORT: Record<Step, string> = {
  kind: 'Type',
  details: 'Projet',
  payment: 'Paiement',
  extras: 'Paiements additionnels',
  balance: 'Solde',
};
const wizardSteps = computed<Step[]>(() => {
  const own: Step[] =
    kind.value === null ? [] : kind.value === 'savings' ? ['details'] : ['payment', 'extras', 'balance'];
  return props.goal ? own : ['kind', ...own];
});
const stepIndex = ref(0);
const step = computed(() => wizardSteps.value[stepIndex.value] ?? 'kind');
const lastStep = computed(() => stepIndex.value === wizardSteps.value.length - 1);

// A kind picked: on to its first step. Setting the step rather than adding to
// it, as the label's click reaches the radio too
function pickKind(value: 'savings' | 'debt') {
  kind.value = value;
  stepIndex.value = 1;
}

function addRate() {
  rates.value.push({ rate: '', from: todayInput() });
}

const parseRate = (text: string) => parseFloat(text.replace(/\s/g, '').replace(',', '.'));

// Whether a step is complete: until it is, "Suivant" (or the submit button)
// waits
const validCents = (text: string) => {
  const cents = toCents(text);
  return !Number.isNaN(cents) && cents > 0;
};
function complete(s: Step): boolean {
  switch (s) {
    case 'kind':
      return kind.value !== null;
    case 'details':
      return !!name.value.trim() && validCents(target.value) && account.value !== undefined;
    case 'payment':
      return !!name.value.trim() && paymentMatches.value.length > 0;
    case 'extras': {
      const count = parsedExtraCount.value;
      return count === null || (Number.isInteger(count) && count >= 0 && count <= 9999);
    }
    case 'balance':
      return (
        (!loan.value.trim() || validCents(loan.value)) &&
        validCents(balance.value) &&
        rates.value.every((r, i) => {
          if (!r.rate.trim()) return true;
          const rate = parseRate(r.rate);
          return !Number.isNaN(rate) && rate >= 0 && rate <= 100 && (i === 0 || !!r.from);
        })
      );
  }
}
// The last step saves: every step complete
const blocked = computed(() => (lastStep.value ? !wizardSteps.value.every(complete) : !complete(step.value)));

function next() {
  if (complete(step.value)) stepIndex.value++;
}

function onOpenChange(value: boolean) {
  if (!saving.value) open.value = value;
}

function body(): SavingsGoalInput | DebtInput {
  if (kind.value === 'savings') {
    return {
      name: name.value,
      targetCents: toCents(target.value),
      dueDate: hasDue.value ? (dueDate.value ?? null) : null,
      account: account.value ?? null,
      hiddenFromTotal: !account.value && hiddenFromTotal.value,
    };
  }
  return {
    kind: 'debt',
    name: name.value,
    debtStartCents: toCents(balance.value),
    loanCents: loan.value.trim() ? toCents(loan.value) : null,
    debtStartDate: balanceDate.value ?? todayInput(),
    // Empty ones dropped, the first from the start
    interestRates: rates.value
      .map((r, i) => ({ ratePercent: parseRate(r.rate), from: i === 0 ? null : r.from! }))
      .filter((_, i) => rates.value[i]!.rate.trim() !== ''),
    paymentMatches: paymentMatches.value,
    extraMatches: extraMatches.value,
    extraRecurrence: extraRecurrence.value,
    extraCount: parsedExtraCount.value,
  };
}

// Enter moves the wizard on, then saves from its last step, once complete
async function submit() {
  if (!lastStep.value) return next();
  if (blocked.value) return;
  saving.value = true;
  error.value = '';
  try {
    if (props.goal) await api.updateSavingsGoal(props.goal._id, body());
    else await api.createSavingsGoal(body());
    open.value = false;
    emit('saved');
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    saving.value = false;
  }
}

// Under the title: the choice while it is to make, then the kind picked
const description = computed(() => {
  if (!props.goal && stepIndex.value === 0)
    return 'Mettez de l’argent de côté pour un projet, ou suivez le remboursement d’un prêt.';
  return kind.value === 'debt'
    ? 'Chaque nouveau paiement importé réduira la dette automatiquement.'
    : 'Un projet pour lequel vous mettez de l’argent de côté : voyage, voiture, mise de fonds…';
});

const submitLabel = computed(() => {
  if (saving.value) return 'Enregistrement…';
  if (props.goal) return 'Enregistrer';
  return kind.value === 'debt' ? 'Suivre cette dette' : "Créer l'objectif";
});
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-lg">
      <form class="flex min-h-0 flex-col gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>{{ goal ? `Modifier « ${goal.name} »` : 'Nouvel objectif' }}</DialogTitle>
          <DialogDescription>
            {{ description }}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <WizardFrame
            v-model="stepIndex"
            :steps="wizardSteps.map((s) => SHORT[s])"
            :title="TITLES[step]"
            :description="DESCRIPTIONS[step]"
            :choice="!goal"
            :error="error"
            cancelable
            :submit-label="submitLabel"
            :saving="saving"
            :blocked="blocked"
            @next="next"
            @cancel="onOpenChange(false)"
          >
            <!-- What to follow -->
            <RadioGroup v-if="step === 'kind'" v-model="kind" class="gap-3" aria-label="Que voulez-vous suivre ?">
              <label :class="CHOICE_CARD" @click="pickKind('savings')">
                <RadioGroupItem value="savings" class="mt-0.5" />
                <span class="flex flex-col gap-1">
                  <span class="flex items-center gap-2 font-medium"><PiggyBank class="size-4" /> Épargner</span>
                  <span class="text-sm text-muted-foreground">
                    Mettre de l'argent de côté pour un projet : voyage, voiture, mise de fonds…
                  </span>
                </span>
              </label>
              <label :class="CHOICE_CARD" @click="pickKind('debt')">
                <RadioGroupItem value="debt" class="mt-0.5" />
                <span class="flex flex-col gap-1">
                  <span class="flex items-center gap-2 font-medium"
                    ><Landmark class="size-4" /> Rembourser une dette</span
                  >
                  <span class="text-sm text-muted-foreground">
                    Suivre un prêt étudiant, une hypothèque ou un prêt auto au fil de vos paiements.
                  </span>
                </span>
              </label>
            </RadioGroup>

            <!-- Savings: the project -->
            <template v-else-if="step === 'details'">
              <div class="flex flex-col gap-2">
                <Label for="goal-name">Nom</Label>
                <Input id="goal-name" v-model="name" placeholder="Voyage au Japon" />
              </div>
              <div class="flex flex-col gap-2">
                <Label for="goal-target">Montant à atteindre</Label>
                <Input id="goal-target" v-model="target" inputmode="decimal" placeholder="0,00" @keydown="noMinus" />
              </div>
              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <Label for="goal-has-due">Date visée</Label>
                  <Switch id="goal-has-due" v-model="hasDue" />
                </div>
                <DatePicker
                  :model-value="hasDue ? dueDate : undefined"
                  :disabled="!hasDue"
                  class="w-full"
                  @update:model-value="dueDate = $event"
                />
                <p class="text-sm text-muted-foreground">
                  En inscrivant une date, vous serez en mesure de planifier des versements égaux pour atteindre votre
                  objectif.
                </p>
              </div>
              <DedicatedAccountField
                id="goal-account"
                v-model="account"
                v-model:hidden-from-total="hiddenFromTotal"
                :accounts="accounts"
                :goal="goal"
              >
                <template #description>
                  <p class="text-sm text-muted-foreground">
                    Si vous avez déjà un compte pour cette épargne, associez-le à cet objectif. Sinon, sélectionnez «
                    Aucun compte » pour mettre de l'argent de côté depuis l'app.
                  </p>
                </template>
              </DedicatedAccountField>
            </template>

            <!-- Debt: its name and the payment followed -->
            <template v-else-if="step === 'payment'">
              <div class="flex flex-col gap-2">
                <Label for="debt-name">Nom</Label>
                <Input id="debt-name" v-model="name" placeholder="Prêt étudiant, hypothèque…" />
              </div>
              <StepTitle
                title="Le paiement de votre prêt"
                description="Choisissez le paiement habituel de votre prêt."
              />
              <PaymentPicker v-model="paymentMatches" :transactions="transactions" label="Paiement du prêt" single />
            </template>

            <!-- Debt: an additional payment, picked, and how many are still planned -->
            <template v-else-if="step === 'extras'">
              <PaymentPicker
                v-model="extraMatches"
                :transactions="transactions"
                label="Paiement additionnel"
                single
                clearable
              />
              <!-- Once an additional payment is picked -->
              <div v-if="extraMatches.length > 0" class="flex flex-col gap-2">
                <Label for="extra-count">Nombre de paiements encore prévus</Label>
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Input
                    id="extra-count"
                    v-model="extraCount"
                    type="number"
                    min="0"
                    max="9999"
                    placeholder="Jusqu'à la fin du prêt"
                    class="w-56"
                  />
                  <!-- The end, as the number is typed -->
                  <span v-if="extraEnd === 'none'" class="text-sm text-muted-foreground">Plus aucun prévu</span>
                  <span v-else-if="extraEnd" class="text-sm">
                    Fin prévue : <span class="font-medium">{{ formatDate(extraEnd.date) }}</span>
                  </span>
                </div>
                <p class="text-sm text-muted-foreground">
                  Au même rythme que le paiement habituel ({{
                    extraEnd && extraEnd !== 'none' ? extraEnd.pace : 'chaque mois'
                  }}), par exemple 500 $ chaque mois pendant 15 mois : ils comptent dans la date de fin du prêt pour ce
                  nombre de paiements. Laissé vide, jusqu'à la fin du prêt.
                </p>
              </div>
            </template>

            <!-- Debt: the balance it starts from, and its rates -->
            <template v-else>
              <div class="flex flex-col gap-2">
                <Label for="debt-loan">
                  Montant emprunté <span class="font-normal text-muted-foreground">(facultatif)</span>
                </Label>
                <Input
                  id="debt-loan"
                  v-model="loan"
                  inputmode="decimal"
                  placeholder="0,00"
                  class="w-56"
                  @keydown="noMinus"
                />
                <p class="text-sm text-muted-foreground">
                  Le montant de votre prêt initial. Sans celui-ci, l'app tentera de le retracer à partir de vos
                  paiements (peut ne pas être exact).
                </p>
              </div>

              <div class="flex flex-col gap-2">
                <Label for="debt-balance">Solde restant</Label>
                <div class="flex flex-wrap items-center gap-2">
                  <Input
                    id="debt-balance"
                    v-model="balance"
                    inputmode="decimal"
                    placeholder="0,00"
                    class="min-w-32 flex-1"
                    @keydown="noMinus"
                  />
                  <span class="text-sm text-muted-foreground">au</span>
                  <DatePicker v-model="balanceDate" class="flex-1" />
                </div>
                <p class="text-sm text-muted-foreground">
                  Le capital restant indiqué sur votre dernier relevé de prêt, après le dernier paiement.
                </p>
              </div>

              <div class="flex flex-col gap-2">
                <Label for="debt-rate-0">Taux d'intérêt annuel</Label>
                <div v-for="(r, i) in rates" :key="i" class="flex flex-wrap items-center gap-2">
                  <div class="relative w-28">
                    <Input
                      :id="`debt-rate-${i}`"
                      v-model="r.rate"
                      inputmode="decimal"
                      placeholder="0,00"
                      class="pr-7"
                      :aria-label="i === 0 ? undefined : `Taux à partir du ${r.from ?? '…'}`"
                      @keydown="noMinus"
                    />
                    <span
                      class="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground"
                    >
                      %
                    </span>
                  </div>
                  <span v-if="i === 0 && rates.length > 1" class="text-sm text-muted-foreground">au départ</span>
                  <template v-else-if="i > 0">
                    <span class="text-sm text-muted-foreground">à partir du</span>
                    <DatePicker v-model="r.from" class="min-w-36 flex-1" />
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Retirer ce taux"
                      title="Retirer ce taux"
                      @click="rates.splice(i, 1)"
                    >
                      <X />
                    </Button>
                  </template>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  class="self-start text-muted-foreground"
                  @click="addRate"
                >
                  <Plus />
                  Ajouter un changement de taux
                </Button>
              </div>
            </template>
          </WizardFrame>
        </DialogBody>
      </form>
    </DialogContent>
  </Dialog>
</template>
