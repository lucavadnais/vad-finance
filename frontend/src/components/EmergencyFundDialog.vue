<script setup lang="ts">
// The emergency fund, in one dialog: what it holds out of its target and the
// share of the income saved, then "Votre cible" -
// the wizard setting it, a stepper over one step at a time: how the target is
// set, then - computed - the essential expenses (ticked here, EssentialsPicker),
// the situation (months of essential spending, from a list with its sources)
// and what is owned (a share of the home, months of rental expenses), or -
// custom - the amount - and where its money is. Everything shows as edited,
// saved at once. Opened through v-model:open.
import type { Account, Category, CategoryGroup, EmergencyFundInput, SavingsGoal, Transaction } from '@/types';
import { computed, ref, watch } from 'vue';
import { ChevronRight, ExternalLink } from '@lucide/vue';
import { api, centsInput, formatCents, noMinus, toCents } from '@/api';
import {
  DEFAULT_FUND_MONTHS,
  ESSENTIAL_MONTHS,
  FUND_SITUATIONS,
  HOME_TIERS,
  HOME_SOURCES,
  RENTAL_MONTHS,
  RENTAL_SOURCES,
  SAVINGS_RATE_TARGET,
  computedFundTarget,
  essentialMonthly,
  fundTarget,
  goalHeldCents,
  homeShare,
  homeTier,
  savingsPace,
} from '@/lib/savings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import DedicatedAccountField from './DedicatedAccountField.vue';
import EssentialsPicker from './EssentialsPicker.vue';
import WizardFrame from './WizardFrame.vue';
import { CHOICE_CARD } from './WizardSteps.vue';

const open = defineModel<boolean>('open', { required: true });
const props = defineProps<{
  fund: SavingsGoal;
  accounts: Account[];
  categories: Category[];
  groups: CategoryGroup[];
  transactions: Transaction[];
  colors: Map<string, string>;
}>();
const emit = defineEmits<{ saved: [] }>();

// ---- The form, from the fund's settings at each opening

// The situation picked, by key, or OTHER: a number of months typed in
const OTHER = 'other';
const mode = ref<'situation' | 'custom'>('situation');
const situation = ref(FUND_SITUATIONS[0]!.key);
const otherMonths = ref('');
const ownsHome = ref(false);
const homeValue = ref('');
const homeBuiltYear = ref('');
const ownsRental = ref(false);
const rentalExpenses = ref('');
const custom = ref('');
const account = ref<string | null | undefined>();
// Without an account: what it holds left out of the total of the accounts
const hiddenFromTotal = ref(false);
// The essential expenses ticked, by group or category id
const ticked = ref<Record<string, boolean>>({});
const saving = ref(false);
const error = ref('');

// Back to the fund as saved; whether it is set up (its target known)
function reset() {
  const f = props.fund;
  ticked.value = Object.fromEntries(f.essentials.map((id) => [id, true]));
  mode.value = f.targetCents === null ? 'situation' : 'custom';
  situation.value = FUND_SITUATIONS.some((s) => s.key === f.fundSituation) ? f.fundSituation! : OTHER;
  otherMonths.value = String(f.fundMonths);
  ownsHome.value = f.homeValueCents > 0;
  homeValue.value = f.homeValueCents > 0 ? centsInput(f.homeValueCents) : '';
  homeBuiltYear.value = f.homeBuiltYear === null ? '' : String(f.homeBuiltYear);
  ownsRental.value = f.rentalExpensesCents > 0;
  rentalExpenses.value = f.rentalExpensesCents > 0 ? centsInput(f.rentalExpensesCents) : '';
  custom.value = f.targetCents ? centsInput(f.targetCents) : '';
  // Not set up yet: no account preselected, one (or "Aucun compte") to pick
  const setUp = fundTarget(f, essentialMonthlyCents.value) !== null;
  account.value = f.account ?? (setUp ? null : undefined);
  hiddenFromTotal.value = f.hiddenFromTotal ?? false;
  error.value = '';
  return setUp;
}

// The groups and categories ticked, those still existing, and their usual month
const essentials = computed(() => {
  const ids = new Set([...props.groups.map((g) => g._id), ...props.categories.map((c) => c._id)]);
  return Object.keys(ticked.value).filter((id) => ticked.value[id] && ids.has(id));
});
const essentialMonthlyCents = computed(() => essentialMonthly(props.transactions, props.categories, essentials.value));
const essentialsChanged = computed(() => {
  const saved = new Set(props.fund.essentials);
  return essentials.value.length !== saved.size || essentials.value.some((id) => !saved.has(id));
});

const months = computed(() =>
  situation.value === OTHER
    ? Number(otherMonths.value)
    : FUND_SITUATIONS.find((s) => s.key === situation.value)!.months,
);
const monthsValid = computed(() => Number.isInteger(months.value) && months.value >= 1 && months.value <= 24);
// An amount typed, or 0 while empty or invalid
const centsOf = (value: string) => {
  const cents = toCents(value || '0');
  return Number.isNaN(cents) ? 0 : Math.max(0, cents);
};
const homeValueCents = computed(() => (ownsHome.value ? centsOf(homeValue.value) : 0));
// The year typed, or null while empty or not a plausible year
const builtYear = computed(() => {
  const year = Number(homeBuiltYear.value);
  return ownsHome.value &&
    homeBuiltYear.value &&
    Number.isInteger(year) &&
    year >= 1600 &&
    year <= new Date().getFullYear()
    ? year
    : null;
});
// The share of its value kept for repairs, and its age bracket (null unknown)
const homeShareNow = computed(() => homeShare(builtYear.value));
const homeTierNow = computed(() => homeTier(builtYear.value));
const homeReserveCents = computed(() => Math.round(homeValueCents.value * homeShareNow.value));
const percent = (share: number) => (share * 100).toLocaleString('fr-CA');
const rentalExpensesCents = computed(() => (ownsRental.value ? centsOf(rentalExpenses.value) : 0));
const computedTarget = computed(() =>
  monthsValid.value
    ? computedFundTarget(
        {
          fundMonths: months.value,
          homeValueCents: homeValueCents.value,
          homeBuiltYear: builtYear.value,
          rentalExpensesCents: rentalExpensesCents.value,
        },
        essentialMonthlyCents.value,
      )
    : null,
);
const customCents = computed(() => {
  const cents = toCents(custom.value);
  return Number.isNaN(cents) || cents <= 0 ? null : cents;
});
const monthsAmount = (n: number) =>
  essentialMonthlyCents.value === null ? '—' : formatCents(n * essentialMonthlyCents.value);

// What would be saved, and whether it differs from the fund
// A custom amount clears the situation's settings: picking the situation later
// starts over from the defaults
const body = computed<EmergencyFundInput>(() => {
  const accountId = account.value ?? null;
  const hidden = accountId === null && hiddenFromTotal.value;
  if (mode.value === 'custom')
    return {
      targetCents: customCents.value,
      fundSituation: FUND_SITUATIONS[0]!.key,
      fundMonths: DEFAULT_FUND_MONTHS,
      homeValueCents: 0,
      homeBuiltYear: null,
      rentalExpensesCents: 0,
      essentials: essentials.value,
      account: accountId,
      hiddenFromTotal: hidden,
    };
  return {
    targetCents: null,
    fundSituation: situation.value === OTHER ? null : situation.value,
    fundMonths: monthsValid.value ? months.value : DEFAULT_FUND_MONTHS,
    homeValueCents: homeValueCents.value,
    homeBuiltYear: builtYear.value,
    rentalExpensesCents: rentalExpensesCents.value,
    essentials: essentials.value,
    account: accountId,
    hiddenFromTotal: hidden,
  };
});
const dirty = computed(() => {
  const f = props.fund;
  const b = body.value;
  return (
    essentialsChanged.value ||
    b.targetCents !== f.targetCents ||
    (b.targetCents === null &&
      (b.fundSituation !== f.fundSituation ||
        b.fundMonths !== f.fundMonths ||
        b.homeValueCents !== f.homeValueCents ||
        b.homeBuiltYear !== f.homeBuiltYear ||
        b.rentalExpensesCents !== f.rentalExpensesCents)) ||
    b.account !== (f.account ?? null) ||
    b.hiddenFromTotal !== (f.hiddenFromTotal ?? false)
  );
});

// ---- The fund, as edited: its target and pace

const target = computed(() => (mode.value === 'situation' ? computedTarget.value : customCents.value));
// The wizard's steps reached so far (its index): the fund shows what they
// set, the rest as blanks. Set up for the first time, it fills in step by
// step; already set up, it is whole from the start.
const seen = ref(0);
const isSeen = (s: Step) => wizardSteps.value.indexOf(s) <= seen.value;
// The target once every step is reached
const shown = computed(() => (seen.value >= wizardSteps.value.length - 1 ? target.value : null));
const held = computed(() => goalHeldCents(props.fund, props.accounts));
const heldPercent = computed(() => (shown.value ? Math.min(100, (held.value / shown.value) * 100) : 0));
const pace = computed(() => savingsPace(props.transactions));
const ratePercent = computed(() => (pace.value?.rate == null ? null : Math.round(pace.value.rate * 100)));

// ---- The wizard

// The wizard under "Votre cible", one step at a time: its steps by how the
// target is set, any of them picked in its stepper
type Step = 'method' | 'essentials' | 'situation' | 'home' | 'amount';
const TITLES: Record<Step, string> = {
  method: 'Comment fixer la cible',
  essentials: 'Vos dépenses essentielles',
  situation: 'Votre situation',
  home: 'Ce que vous possédez',
  amount: 'Le montant',
};
const SHORT: Record<Step, string> = {
  method: 'Méthode',
  essentials: 'Dépenses',
  situation: 'Situation',
  home: 'Biens',
  amount: 'Montant',
};
const wizardSteps = computed<Step[]>(() =>
  mode.value === 'situation' ? ['method', 'essentials', 'situation', 'home'] : ['method', 'amount'],
);
const stepIndex = ref(0);
// The method shows as picked once set: none is suggested before the first
const methodPicked = ref(false);
const step = computed(() => wizardSteps.value[stepIndex.value] ?? 'method');
const lastStep = computed(() => stepIndex.value === wizardSteps.value.length - 1);

// "Suivant" waits for the months (situation) or the amount (custom)
const stepComplete = computed(() => {
  if (step.value === 'situation') return monthsValid.value;
  if (step.value === 'amount') return customCents.value !== null;
  return true;
});

function start() {
  const setUp = reset();
  stepIndex.value = 0;
  seen.value = setUp ? Infinity : 0;
  methodPicked.value = seen.value !== 0;
  calcOpen.value = seen.value === 0;
}
watch(open, (value) => {
  if (value) start();
});
watch(stepIndex, (i) => (seen.value = Math.max(seen.value, i)));
// "Voir comment la cible est calculée": open while setting up, to see it fill in
const calcOpen = ref(false);

function onOpenChange(value: boolean) {
  if (!saving.value) open.value = value;
}

// A method picked: on to its first step. Setting the step rather than adding
// to it, as the label's click reaches the radio too
function pickMethod(value: 'situation' | 'custom') {
  mode.value = value;
  methodPicked.value = true;
  stepIndex.value = 1;
}

// Enter moves the wizard on, then saves from its last step
async function submit() {
  if (!lastStep.value) {
    stepIndex.value++;
    return;
  }
  if (target.value === null || account.value === undefined || !dirty.value) return;
  saving.value = true;
  error.value = '';
  try {
    await api.updateSavingsGoal(props.fund._id, body.value);
    open.value = false;
    emit('saved');
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-lg md:max-w-4xl">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>Fonds d'urgence</DialogTitle>
          <DialogDescription
            >Un coussin pour les imprévus : perte d'emploi, maladie, grosse réparation.</DialogDescription
          >
        </DialogHeader>

        <!-- Two columns from a tablet: the wizard setting its target, then the fund and its account (on top on a phone) -->
        <DialogBody class="md:grid md:grid-cols-2 md:items-start md:gap-6">
          <div class="flex min-w-0 flex-col gap-4">
            <!-- What it holds out of its target -->
            <section class="flex flex-col gap-4 rounded-xl bg-muted p-4">
              <!-- The amount to save first, what is already aside beside it -->
              <div class="flex items-end justify-between gap-4">
                <div class="flex flex-col">
                  <span class="text-sm text-muted-foreground">Cible</span>
                  <span class="text-3xl font-semibold tabular-nums">{{
                    shown === null ? '—' : formatCents(shown)
                  }}</span>
                </div>
                <span class="pb-1 text-sm text-muted-foreground tabular-nums">
                  {{ formatCents(held) }} mis de côté
                </span>
              </div>
              <Progress :model-value="heldPercent" class="h-2.5 bg-background" />
              <!-- How the target adds up, filling in with the wizard -->
              <Collapsible v-model:open="calcOpen" class="flex flex-col text-sm">
                <CollapsibleTrigger as-child>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    class="h-auto self-start p-0 text-muted-foreground has-[>svg]:px-0"
                  >
                    Voir comment la cible est calculée
                    <ChevronRight class="transition-transform" :class="calcOpen && 'rotate-90'" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <dl class="flex flex-col divide-y divide-border/60 pt-2">
                    <template v-if="mode === 'situation'">
                      <div class="flex justify-between gap-4 py-1.5">
                        <dt class="text-muted-foreground">Dépenses essentielles par mois</dt>
                        <dd class="tabular-nums">
                          {{
                            isSeen('essentials') && essentialMonthlyCents !== null
                              ? formatCents(essentialMonthlyCents)
                              : '—'
                          }}
                        </dd>
                      </div>
                      <div class="flex justify-between gap-4 py-1.5">
                        <dt class="text-muted-foreground">
                          × {{ isSeen('situation') && monthsValid ? `${months} mois` : 'mois à tenir' }}
                        </dt>
                        <dd class="tabular-nums">
                          {{
                            isSeen('situation') && monthsValid && essentialMonthlyCents !== null
                              ? formatCents(months * essentialMonthlyCents)
                              : '—'
                          }}
                        </dd>
                      </div>
                      <div class="flex justify-between gap-4 py-1.5">
                        <dt class="text-muted-foreground">+ Réserve pour la maison</dt>
                        <dd class="tabular-nums">{{ isSeen('home') ? formatCents(homeReserveCents) : '—' }}</dd>
                      </div>
                      <div class="flex justify-between gap-4 py-1.5">
                        <dt class="text-muted-foreground">+ Réserve pour les immeubles</dt>
                        <dd class="tabular-nums">
                          {{ isSeen('home') ? formatCents(rentalExpensesCents * RENTAL_MONTHS) : '—' }}
                        </dd>
                      </div>
                    </template>
                    <div v-else class="flex justify-between gap-4 py-1.5">
                      <dt class="text-muted-foreground">Montant de votre choix</dt>
                      <dd class="tabular-nums">
                        {{ isSeen('amount') && customCents !== null ? formatCents(customCents) : '—' }}
                      </dd>
                    </div>
                    <div class="flex justify-between gap-4 py-1.5 font-medium">
                      <dt>= Cible</dt>
                      <dd class="tabular-nums">{{ shown === null ? '—' : formatCents(shown) }}</dd>
                    </div>
                  </dl>
                </CollapsibleContent>
              </Collapsible>
              <!-- The share of the income saved lately, against the usual guideline -->
              <div v-if="pace" class="flex items-end justify-between gap-4 border-t border-border/60 pt-3 text-sm">
                <div class="flex flex-col">
                  <span class="text-muted-foreground">Taux d'épargne · 3 derniers mois</span>
                  <span class="text-xs text-muted-foreground">Repère : {{ SAVINGS_RATE_TARGET * 100 }} %</span>
                </div>
                <span
                  class="text-xl font-semibold tabular-nums"
                  :class="ratePercent !== null && ratePercent >= SAVINGS_RATE_TARGET * 100 && 'text-emerald-600'"
                >
                  {{ ratePercent === null ? '—' : `${ratePercent} %` }}
                </span>
              </div>
            </section>

            <DedicatedAccountField
              id="fund-account"
              v-model="account"
              v-model:hidden-from-total="hiddenFromTotal"
              :accounts="accounts"
              :goal="fund"
            >
              <template #description>
                <p class="text-sm text-muted-foreground">
                  Si vous avez déjà un compte pour votre fonds d'urgence, associez-le ici. Sinon, sélectionnez « Aucun
                  compte » pour mettre de l'argent de côté depuis l'app.
                </p>
              </template>
              <p v-if="account" class="text-sm text-muted-foreground">Le fonds suit le solde de ce compte.</p>
            </DedicatedAccountField>
            <p class="text-xs text-muted-foreground">Repères généraux, pas un conseil financier personnalisé.</p>
          </div>

          <div class="flex min-w-0 flex-col gap-4 md:order-first">
            <!-- How the target is set: the wizard, its stepper on top -->
            <WizardFrame
              v-model="stepIndex"
              class="max-h-165 rounded-xl border p-4"
              :steps="wizardSteps.map((s) => SHORT[s])"
              :title="TITLES[step]"
              choice
              :blocked="!stepComplete"
              @next="stepIndex++"
            >
              <!-- How the target is set -->
              <RadioGroup
                v-if="step === 'method'"
                :model-value="methodPicked ? mode : undefined"
                class="gap-3"
                aria-label="Comment fixer la cible"
              >
                <label :class="CHOICE_CARD" @click="pickMethod('situation')">
                  <RadioGroupItem value="situation" class="mt-0.5" />
                  <span class="flex flex-col gap-1">
                    <span class="flex items-center gap-2 font-medium">
                      Selon ma situation <Badge variant="secondary">Recommandé</Badge>
                    </span>
                    <span class="text-sm text-muted-foreground">
                      L'app calcule la cible à partir de vos dépenses essentielles et des repères des banques.
                    </span>
                  </span>
                </label>
                <label :class="CHOICE_CARD" @click="pickMethod('custom')">
                  <RadioGroupItem value="custom" class="mt-0.5" />
                  <span class="flex flex-col gap-1">
                    <span class="font-medium">Un montant de mon choix</span>
                    <span class="text-sm text-muted-foreground">Vous fixez vous-même le montant à atteindre.</span>
                  </span>
                </label>
              </RadioGroup>

              <!-- The essential expenses, the base of the amounts -->
              <template v-else-if="step === 'essentials'">
                <p class="text-sm text-muted-foreground">
                  Cochez ce que vous devez payer chaque mois quoi qu'il arrive : logement, épicerie, transport…
                </p>
                <EssentialsPicker v-model="ticked" :categories="categories" :groups="groups" :colors="colors" />
                <div class="flex flex-col gap-0.5 rounded-xl bg-muted p-3">
                  <div class="flex items-baseline justify-between gap-4">
                    <span class="text-sm">Un mois habituel</span>
                    <span class="text-lg font-semibold tabular-nums">
                      {{ essentialMonthlyCents === null ? '—' : formatCents(essentialMonthlyCents) }}
                    </span>
                  </div>
                  <p class="text-xs text-muted-foreground">
                    La médiane de vos {{ ESSENTIAL_MONTHS }} derniers mois complets
                  </p>
                </div>
              </template>

              <!-- The situations: what is usually recommended, and how much that is -->
              <template v-else-if="step === 'situation'">
                <p class="text-sm text-muted-foreground">Combien de mois sans revenu voulez-vous pouvoir tenir ?</p>
                <RadioGroup v-model="situation" class="gap-2" aria-label="Votre situation">
                  <label v-for="s in FUND_SITUATIONS" :key="s.key" :class="CHOICE_CARD" class="p-3">
                    <RadioGroupItem :value="s.key" class="mt-0.5" />
                    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span class="flex justify-between gap-3">
                        <span class="text-sm font-medium">{{ s.label }}</span>
                        <span class="shrink-0 text-sm font-medium tabular-nums">{{ monthsAmount(s.months) }}</span>
                      </span>
                      <span class="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                        {{ s.range }} ·
                        <a
                          v-for="src in s.sources"
                          :key="src.url"
                          :href="src.url"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="inline-flex items-center gap-0.5 underline-offset-2 hover:underline"
                          @click.stop
                        >
                          {{ src.label }}
                          <ExternalLink class="size-3" />
                        </a>
                      </span>
                    </span>
                  </label>
                  <label :class="CHOICE_CARD" class="items-center p-3">
                    <RadioGroupItem :value="OTHER" />
                    <span class="flex flex-1 items-center justify-between gap-3">
                      <span class="flex items-center gap-2 text-sm font-medium">
                        Autre
                        <Input
                          v-model="otherMonths"
                          type="number"
                          min="1"
                          max="24"
                          class="h-8 w-16"
                          aria-label="Nombre de mois"
                          @focus="situation = OTHER"
                        />
                        mois
                      </span>
                      <span class="text-sm font-medium tabular-nums">
                        {{ situation === OTHER && monthsValid ? monthsAmount(months) : '' }}
                      </span>
                    </span>
                  </label>
                </RadioGroup>
              </template>

              <!-- What one owns adds to it -->
              <template v-else-if="step === 'home'">
                <p class="text-sm text-muted-foreground">
                  Facultatif : une maison ou des immeubles demandent une réserve de plus pour les grosses réparations.
                </p>
                <div class="flex flex-col gap-3 rounded-xl border p-4">
                  <div class="flex items-center gap-2">
                    <Switch id="fund-home" v-model="ownsHome" />
                    <Label for="fund-home">Propriétaire de ma maison</Label>
                  </div>
                  <template v-if="ownsHome">
                    <div class="flex items-center gap-2">
                      <Input
                        v-model="homeValue"
                        inputmode="decimal"
                        placeholder="Valeur de la maison"
                        aria-label="Valeur de la maison"
                        class="min-w-0 flex-1"
                        @keydown="noMinus"
                      />
                      <Input
                        v-model="homeBuiltYear"
                        type="number"
                        inputmode="numeric"
                        min="1600"
                        :max="new Date().getFullYear()"
                        placeholder="Construite en"
                        aria-label="Année de construction"
                        class="w-32 shrink-0"
                      />
                    </div>
                    <p class="flex justify-between gap-2 text-sm">
                      <span class="text-muted-foreground">
                        {{ percent(homeShareNow) }} % de sa valeur{{
                          homeTierNow ? ` (${homeTierNow.label})` : ', son âge inconnu'
                        }}
                      </span>
                      <span class="shrink-0 font-medium tabular-nums">+ {{ formatCents(homeReserveCents) }}</span>
                    </p>
                    <p class="text-xs text-muted-foreground">
                      Plus elle est vieille, plus la part est grande :
                      <template v-for="(t, i) in HOME_TIERS" :key="t.label"
                        >{{ percent(t.share) }} % ({{ t.label }}){{ i < HOME_TIERS.length - 1 ? ', ' : '' }}</template
                      >
                      · Sources :
                      <template v-for="(src, i) in HOME_SOURCES" :key="src.url">
                        <a
                          :href="src.url"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="underline-offset-2 hover:underline"
                          >{{ src.label }}</a
                        >{{ i < HOME_SOURCES.length - 1 ? ', ' : '' }}
                      </template>
                    </p>
                  </template>
                </div>
                <div class="flex flex-col gap-3 rounded-xl border p-4">
                  <div class="flex items-center gap-2">
                    <Switch id="fund-rental" v-model="ownsRental" />
                    <Label for="fund-rental">Propriétaire d'immeubles locatifs</Label>
                  </div>
                  <template v-if="ownsRental">
                    <div class="flex items-center gap-2">
                      <Input
                        v-model="rentalExpenses"
                        inputmode="decimal"
                        placeholder="Dépenses par mois"
                        aria-label="Dépenses mensuelles des immeubles"
                        class="min-w-0 flex-1"
                        @keydown="noMinus"
                      />
                      <span class="shrink-0 text-sm font-medium tabular-nums">
                        + {{ formatCents(rentalExpensesCents * RENTAL_MONTHS) }}
                      </span>
                    </div>
                    <!-- Counted twice otherwise: once in the months of essential spending -->
                    <p class="text-xs text-amber-600">N'incluez pas ce qui est déjà dans vos dépenses essentielles.</p>
                    <p class="text-xs text-muted-foreground">
                      Hypothèque, taxes, assurances et entretien : {{ RENTAL_MONTHS }} mois de réserve pour un logement
                      vacant ou une grosse réparation · Sources :
                      <template v-for="(src, i) in RENTAL_SOURCES" :key="src.url">
                        <a
                          :href="src.url"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="underline-offset-2 hover:underline"
                          >{{ src.label }}</a
                        >{{ i < RENTAL_SOURCES.length - 1 ? ', ' : '' }}
                      </template>
                    </p>
                  </template>
                </div>
              </template>

              <!-- A custom amount -->
              <div v-else class="flex flex-col gap-2">
                <Label for="fund-custom">Montant à atteindre</Label>
                <Input
                  id="fund-custom"
                  v-model="custom"
                  inputmode="decimal"
                  placeholder="0,00"
                  class="h-11 text-lg"
                  @keydown="noMinus"
                />
              </div>
            </WizardFrame>
          </div>
        </DialogBody>

        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

        <!-- Saved at once, or closed when nothing changed -->
        <DialogFooter>
          <template v-if="dirty">
            <Button type="button" variant="outline" :disabled="saving" @click="start">Annuler</Button>
            <!-- An account (or "Aucun compte") picked too -->
            <Button type="submit" :disabled="saving || target === null || account === undefined">
              {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
            </Button>
          </template>
          <Button v-else type="button" @click="onOpenChange(false)">Fermer</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
