<script setup lang="ts">
// The goals, as virtual safes: money put aside stays in the accounts, each
// goal keeps a share of it (or follows a dedicated account), and what is left
// is the free money (a warning offers to take back what goes over). First the
// emergency fund (EmergencyFundDialog), then the user's goals, then their
// debts (SavingsGoalDialog, lib/debts.ts), each a SavingsGoalTile.
import type { Account, Category, CategoryGroup, SavingsGoal, Transaction } from '@/types';
import { computed, ref } from 'vue';
import { Plus, Target, TriangleAlert } from '@lucide/vue';
import { api, formatCents, formatCentsShort, todayInput } from '@/api';
import { useFinanceData } from '@/composables/useFinanceData';
import {
  essentialMonthly,
  freeCents,
  fundTarget as targetOf,
  goalHeldCents,
  rebalancePlan,
  durationLabel,
} from '@/lib/savings';
import { type DebtStatus, debtStatus, monthLabel, monthsUntil, paceLabel } from '@/lib/debts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ConfirmDialog from './ConfirmDialog.vue';
import EmergencyFundDialog from './EmergencyFundDialog.vue';
import PageBar from './PageBar.vue';
import SavingsGoalDialog from './SavingsGoalDialog.vue';
import SavingsGoalTile, { type SmallRing } from './SavingsGoalTile.vue';
import SavingsMovementDialog from './SavingsMovementDialog.vue';
import DebtPrepaymentDialog from './DebtPrepaymentDialog.vue';

const props = defineProps<{
  accounts: Account[];
  categories: Category[];
  groups: CategoryGroup[];
  transactions: Transaction[];
  goals: SavingsGoal[];
  colors: Map<string, string>;
}>();
const emit = defineEmits<{ changed: []; error: [message: string] }>();

// The free money, the most that can be put aside
const free = computed(() => freeCents(props.accounts, props.goals));
const heldOf = (g: SavingsGoal) => goalHeldCents(g, props.accounts);
const accountOf = (g: SavingsGoal) => props.accounts.find((a) => a._id === g.account);

// The emergency fund (the backend creates it), and its target
const fund = computed(() => props.goals.find((g) => g.emergency));
const others = computed(() => props.goals.filter((g) => !g.emergency && g.kind !== 'debt'));
const debts = computed(() => props.goals.filter((g) => g.kind === 'debt'));
// Each debt's balance, payments and end, by id
const debtStatuses = computed(
  () => new Map(debts.value.map((g) => [g._id, debtStatus(g, props.transactions)] as const)),
);
const statusOf = (g: SavingsGoal) => debtStatuses.value.get(g._id)!;

// A debt's small rings: paid this month on the left, the time to the end on
// the right (filling with the share repaid)
function debtLeft(s: DebtStatus): SmallRing {
  if (s.paidThisMonthCents > 0)
    return { value: 100, label: formatCentsShort(s.paidThisMonthCents), caption: 'payé ce mois' };
  // The usual payment and the additional one, starred: the note under the
  // tile says what it includes
  if (s.paymentCents) {
    const star = s.extraCents > 0 ? '*' : '';
    return { value: 0, label: formatCentsShort(s.paymentCents + s.extraCents) + star, caption: 'à payer' };
  }
  return { value: 0, label: '—', caption: 'aucun paiement' };
}
function debtRight(s: DebtStatus): SmallRing {
  if (s.remainingCents === 0) return { value: 100, label: '✓', caption: 'remboursée' };
  if (s.payoffMs === null) return { value: 0, label: '—', caption: 'fin inconnue' };
  const share = s.originCents ? (s.paidCents / s.originCents) * 100 : 0;
  return { value: share, label: durationLabel(Math.max(1, monthsUntil(s.payoffMs))), caption: 'restants' };
}

const monthlyCents = computed(() =>
  fund.value ? essentialMonthly(props.transactions, props.categories, fund.value.essentials) : null,
);
const fundTarget = computed(() => (fund.value ? targetOf(fund.value, monthlyCents.value) : null));
const fundHeld = computed(() => (fund.value ? heldOf(fund.value) : 0));
// The months of essential spending it covers instead of the time left (it has
// no date), filled up to its target
const fundRing = computed<SmallRing | undefined>(() => {
  if (fundTarget.value === null || !monthlyCents.value) return undefined;
  const months = fundHeld.value / monthlyCents.value;
  return {
    value: fundTarget.value ? (fundHeld.value / fundTarget.value) * 100 : 0,
    label: `${months.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} mois`,
    caption: 'couverts',
  };
});

// The fund explained, its target, essential expenses and account
// (EmergencyFundDialog)
const fundOpen = ref(false);

// The accounts `goal` may follow: one followed by another goal is not offered,
// both would count its whole balance (the backend refuses it too)
const accountsFor = (goal: SavingsGoal | null) =>
  props.accounts.filter((a) => !props.goals.some((g) => g.account === a._id && g._id !== goal?._id));

// What the end foreseen counts of the additional payment: "Inclut un
// paiement additionnel de 320,00 $ pendant 32 mois"
function extraNote(s: DebtStatus) {
  const amount = formatCents(s.extraCents);
  if (s.extraRemaining === null) return `Inclut un paiement additionnel de ${amount} jusqu'à la fin du prêt`;
  const monthly = paceLabel(s.intervalDays) === 'chaque mois';
  const n = s.extraRemaining;
  return `Inclut un paiement additionnel de ${amount} pendant ${n} ${monthly ? 'mois' : n > 1 ? 'paiements' : 'paiement'}`;
}

// Dialog adding a goal, or editing `editing`
const goalOpen = ref(false);
const editing = ref<SavingsGoal | null>(null);
function openGoal(goal: SavingsGoal | null) {
  editing.value = goal;
  goalOpen.value = true;
}

// Dialogs putting money aside in a goal, or a prepayment on a debt. Kept on
// the goal's id: the goal changes with each movement, its history with it.
function dialogFor() {
  const isOpen = ref(false);
  const id = ref<string | null>(null);
  const goal = computed(() => props.goals.find((g) => g._id === id.value) ?? null);
  const show = (g: SavingsGoal) => {
    id.value = g._id;
    isOpen.value = true;
  };
  return { isOpen, goal, show };
}
const { isOpen: movingOpen, goal: moving, show: openMovement } = dialogFor();
const { isOpen: prepayOpen, goal: prepaying, show: openPrepayment } = dialogFor();
const { putGoal } = useFinanceData();

// The goals keeping more than the accounts hold: how much, and what to take
// back from which to fix it (lib/savings.ts)
const over = computed(() => Math.max(0, -free.value));
const rebalance = computed(() => rebalancePlan(props.accounts, props.goals));
const rebalanceDescription = computed(
  () =>
    rebalance.value.plan.map(({ goal, cents }) => `${goal.name} : −${formatCents(cents)}`).join(' · ') +
    ". L'argent ne bouge pas dans vos comptes ; ces retraits sont notés dans l'historique de chaque objectif.",
);
const rebalancing = ref(false);
async function applyRebalance() {
  rebalancing.value = true;
  const body = { date: todayInput(), note: 'Rééquilibrage : solde des comptes insuffisant' };
  // Each goal on its own, all at once: those that went through are kept
  const results = await Promise.allSettled(
    rebalance.value.plan.map(({ goal, cents }) => api.addSavingsMovement(goal._id, { ...body, amountCents: -cents })),
  );
  for (const r of results) {
    if (r.status === 'fulfilled') putGoal(r.value);
    else emit('error', (r.reason as Error).message);
  }
  rebalancing.value = false;
}

async function remove(goal: SavingsGoal) {
  try {
    await api.deleteSavingsGoal(goal._id);
    emit('changed');
  } catch (err) {
    emit('error', (err as Error).message);
  }
}
</script>

<template>
  <!-- A card on a computer; flat in its tab on a phone, like the budget -->
  <!-- #goals: scrolled to from the announcement (WhatsNewDialog) -->
  <Card
    id="goals"
    class="scroll-mt-24 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:py-0 max-md:shadow-none"
  >
    <!-- Phone: its tab's bar, like the budget's -->
    <PageBar title="Objectifs" class="md:hidden" />
    <CardHeader class="max-md:px-0">
      <CardTitle class="flex min-h-8 items-center text-lg max-md:hidden">Objectifs</CardTitle>
      <CardDescription>
        Réservez une part de votre argent sans ouvrir de compte, et suivez le remboursement de vos prêts.
      </CardDescription>
    </CardHeader>

    <CardContent class="flex flex-col gap-4 max-md:px-0">
      <!-- The goals keep more than the accounts hold: say so, and offer to take
           the difference back -->
      <div
        v-if="over > 0"
        role="alert"
        class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"
      >
        <TriangleAlert class="size-5 shrink-0 text-amber-600" />
        <p class="min-w-0 flex-1">
          Vos objectifs réservent <span class="font-medium tabular-nums">{{ formatCents(over) }}</span> de plus que ce
          que contiennent vos comptes.
          <template v-if="rebalance.shortCents > 0">
            Les objectifs liés à un compte suivent son solde : vérifiez les soldes de vos comptes.
          </template>
        </p>
        <ConfirmDialog
          v-if="rebalance.plan.length > 0"
          title="Rééquilibrer vos objectifs ?"
          :description="rebalanceDescription"
          confirm-label="Rééquilibrer"
          :destructive="false"
          @confirm="applyRebalance"
        >
          <Button size="sm" variant="outline" class="bg-background" :disabled="rebalancing">
            {{ rebalancing ? 'Rééquilibrage…' : 'Rééquilibrer' }}
          </Button>
        </ConfirmDialog>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <!-- The emergency fund, always first; its right ring shows the months
             it covers, its pace behind the pencil -->
        <SavingsGoalTile
          v-if="fund"
          :goal="fund"
          :held-cents="fundHeld"
          :target-cents="fundTarget"
          :account="accountOf(fund)"
          :right="fundRing"
          @add="openMovement(fund)"
          @edit="fundOpen = true"
        >
          <Button v-if="fundTarget === null" size="sm" variant="secondary" @click="fundOpen = true">
            <Target />
            Définir la cible
          </Button>
        </SavingsGoalTile>

        <SavingsGoalTile
          v-for="g in others"
          :key="g._id"
          :goal="g"
          :held-cents="heldOf(g)"
          :target-cents="g.targetCents"
          :account="accountOf(g)"
          @add="openMovement(g)"
          @edit="openGoal(g)"
          @remove="remove(g)"
        />

        <!-- The debts, after the goals; their end and pace under the rings -->
        <SavingsGoalTile
          v-for="g in debts"
          :key="g._id"
          :goal="g"
          :held-cents="statusOf(g).paidCents"
          :target-cents="statusOf(g).originCents"
          :left="debtLeft(statusOf(g))"
          :right="debtRight(statusOf(g))"
          @add="openPrepayment(g)"
          @edit="openGoal(g)"
          @remove="remove(g)"
        >
          <p class="text-center text-sm text-muted-foreground">
            <template v-if="statusOf(g).remainingCents === 0">Plus rien à payer.</template>
            <template v-else-if="statusOf(g).paymentCents === null"> En attente d'un premier paiement. </template>
            <template v-else-if="statusOf(g).payoffMs === null">
              À ce rythme, les paiements ne couvrent pas les intérêts.
            </template>
            <template v-else> Fin prévue en {{ monthLabel(statusOf(g).payoffMs!) }}. </template>
          </p>
          <!-- The additional payment counted in it, as a footnote -->
          <p
            v-if="statusOf(g).payoffMs !== null && statusOf(g).remainingCents > 0 && statusOf(g).extraCents > 0"
            class="text-center text-xs text-muted-foreground"
          >
            * {{ extraNote(statusOf(g)) }}
          </p>
        </SavingsGoalTile>

        <!-- One more goal or debt. Phone: the budget's "+", without a title,
             first and lying flat -->
        <button
          type="button"
          class="order-first flex h-16 items-center justify-center rounded-full border-2 text-foreground transition-colors hover:bg-muted md:hidden"
          aria-label="Nouvel objectif"
          title="Nouvel objectif"
          @click="openGoal(null)"
        >
          <Plus class="size-6" />
        </button>
        <!-- Computer: a tile among them -->
        <button
          type="button"
          class="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 p-4 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/60 hover:text-foreground max-md:hidden"
          @click="openGoal(null)"
        >
          <span class="flex size-10 items-center justify-center rounded-full border">
            <Plus class="size-5" />
          </span>
          <span class="font-medium">Nouvel objectif</span>
          <span v-if="others.length + debts.length === 0" class="text-center">
            Un voyage, une mise de fonds, un prêt étudiant, une hypothèque…
          </span>
        </button>
      </div>
    </CardContent>

    <EmergencyFundDialog
      v-if="fund"
      v-model:open="fundOpen"
      :fund="fund"
      :accounts="accountsFor(fund)"
      :categories="categories"
      :groups="groups"
      :transactions="transactions"
      :colors="colors"
      @saved="emit('changed')"
    />
    <SavingsGoalDialog
      v-model:open="goalOpen"
      :goal="editing"
      :accounts="accountsFor(editing)"
      :transactions="transactions"
      @saved="emit('changed')"
    />
    <DebtPrepaymentDialog v-model:open="prepayOpen" :goal="prepaying" :transactions="transactions" />
    <SavingsMovementDialog v-model:open="movingOpen" :goal="moving" :free-cents="free" />
  </Card>
</template>
