<script lang="ts">
// A small ring's fill (0 to 100), its figure and the word under it
export interface SmallRing {
  value: number;
  label: string;
  caption: string;
}
</script>

<script setup lang="ts">
// One savings goal as a tile: its icon and name on top with its "…" menu, a
// ring of what it holds out of its target, and two arcs around it (GoalRings)
// - on the left what was put aside this month against what each month needs,
// on the right the time left to its date (filling as it goes by) - their
// figures in the bottom corners, and a "+" putting money aside under them. A goal following an
// account shows a sync sign instead: it changes with the balance. `left` /
// `right` replace an arc (the emergency fund shows its step); the default
// slot adds a line under them. A debt (goal.kind 'debt') shows what is left
// to pay in the ring, the repaid share filling it (`heldCents` = repaid since the first
// payment found, `targetCents` = what was owed before it), and
// the sync sign: it follows its payments.
import type { Account, SavingsGoal } from '@/types';
import type { SheetAction } from './ActionSheet.vue';
import { computed, ref } from 'vue';
import { Ellipsis, HandCoins, Landmark, Pencil, Plus, RefreshCw, Target, Trash2 } from '@lucide/vue';
import { formatCents, formatCentsShort } from '@/api';
import { durationLabel, heldThisMonth, monthlyNeeded, monthsLeft, timeElapsed } from '@/lib/savings';
import { Button } from '@/components/ui/button';
import ActionMenu from './ActionMenu.vue';
import ConfirmDialog from './ConfirmDialog.vue';
import GoalRings from './GoalRings.vue';

const props = defineProps<{
  goal: SavingsGoal;
  heldCents: number;
  // Null while unknown (the emergency fund without essential expenses)
  targetCents: number | null;
  account?: Account;
  left?: SmallRing;
  right?: SmallRing;
}>();
const emit = defineEmits<{ add: []; edit: []; remove: [] }>();

const isDebt = computed(() => props.goal.kind === 'debt');
const percent = computed(() => (props.targetCents ? (props.heldCents / props.targetCents) * 100 : 0));
const reached = computed(() => props.targetCents !== null && props.heldCents >= props.targetCents);
// The ring turns greener as the goal gets closer: amber far from it, then yellow,
// lime, and green once reached
const ringClass = computed(() => {
  if (reached.value) return 'stroke-emerald-600';
  if (percent.value >= 66) return 'stroke-lime-500';
  if (percent.value >= 33) return 'stroke-yellow-500';
  return 'stroke-amber-500';
});

// This month's money put aside against what each month needs to be in time
const monthly = computed<SmallRing>(() => {
  if (props.left) return props.left;
  // Reached: nothing more to put aside
  if (reached.value) return { value: 100, label: formatCentsShort(0), caption: 'par mois' };
  const thisMonth = heldThisMonth(props.goal);
  // Needed each month from what the goal held when this one began: this
  // month's money counts towards it instead of lowering it
  const needed =
    props.targetCents === null
      ? null
      : monthlyNeeded(props.targetCents, props.heldCents - thisMonth, props.goal.dueDate);
  if (typeof needed === 'number') {
    // This month's share put aside, or more
    if (thisMonth >= needed) return { value: 100, label: formatCentsShort(thisMonth), caption: 'ce mois-ci' };
    return { value: (thisMonth / needed) * 100, label: formatCentsShort(needed), caption: 'par mois' };
  }
  // Without a date: this month's share of the target
  const share = props.targetCents ? (thisMonth / props.targetCents) * 100 : 0;
  return { value: share, label: formatCentsShort(Math.max(0, thisMonth)), caption: 'ce mois-ci' };
});

// The time left to the date, the ring filling as it goes by
const time = computed<SmallRing>(() => {
  if (props.right) return props.right;
  if (reached.value) return { value: 100, label: '✓', caption: 'atteint' };
  if (!props.goal.dueDate) return { value: 0, label: '—', caption: 'sans date' };
  const left = monthsLeft(props.goal.dueDate);
  if (left === 0) return { value: 100, label: '0 mois', caption: 'date dépassée' };
  return { value: timeElapsed(props.goal), label: durationLabel(left), caption: 'restants' };
});

// Updating by itself: following an account's balance, or a debt's payments
const syncTitle = computed(() => {
  if (isDebt.value) {
    const all = [...props.goal.paymentMatches, ...props.goal.extraMatches];
    return `Suit automatiquement vos paiements ${all.map((m) => `« ${m.description} »`).join(', ')}`;
  }
  return props.account ? `Suit automatiquement le solde de ${props.account.name}` : null;
});

const confirmOpen = ref(false);
// What deleting does to the money: nothing leaves the accounts, whether the
// goal follows one or was saved in the app
const removeDescription = computed(() => {
  if (isDebt.value) return 'Vos transactions ne sont pas touchées : seul le suivi de cette dette est supprimé.';
  if (props.account) return `Votre compte « ${props.account.name} » et son solde ne sont pas touchés.`;
  if (props.heldCents <= 0) return "Rien n'y a encore été mis de côté.";
  // Saved in the app: only the reservation goes, the money never left the accounts
  return `Les ${formatCents(props.heldCents)} réservés dans l'app pour cet objectif sont libérés et leur historique est effacé. Cet argent n'a jamais quitté vos comptes : il redevient disponible pour vos dépenses ou un autre objectif.`;
});
// Putting aside goes through the "+"; its dialog lists the movements, to delete
const actions = computed<SheetAction[]>(() => [
  { label: 'Modifier', icon: Pencil, run: () => emit('edit') },
  ...(props.goal.emergency
    ? []
    : [{ label: 'Supprimer', icon: Trash2, destructive: true, run: () => (confirmOpen.value = true) }]),
]);
</script>

<template>
  <article class="relative flex flex-col items-center gap-4 rounded-2xl border bg-card p-5">
    <!-- The menu, in the corner (its action alone when it has one, e.g. the
         emergency fund, which cannot be deleted); the title centered -->
    <Button
      v-if="actions.length === 1"
      size="icon-sm"
      variant="ghost"
      class="absolute top-3 right-3"
      :aria-label="actions[0]!.label"
      :title="actions[0]!.label"
      @click="actions[0]!.run()"
    >
      <component :is="actions[0]!.icon" />
    </Button>
    <ActionMenu v-else :title="goal.name" :actions="actions">
      <Button size="icon-sm" variant="ghost" class="absolute top-3 right-3" aria-label="Actions" title="Actions">
        <Ellipsis />
      </Button>
    </ActionMenu>
    <header class="flex max-w-full flex-col items-center gap-1 px-8">
      <h3 class="flex max-w-full items-center gap-2 text-lg font-semibold">
        <Landmark v-if="isDebt" class="size-5 shrink-0 text-muted-foreground" />
        <Target v-else-if="!goal.emergency" class="size-5 shrink-0 text-muted-foreground" />
        <span class="truncate">{{ goal.name }}</span>
      </h3>
    </header>

    <!-- What it holds, out of its target, in the inner ring; the month and
         the time in the arcs around it, their figures in the bottom corners,
         beside the opening; the "+" under them (or, following an account, a
         sign that it updates by itself) -->
    <div class="flex flex-col items-center gap-2">
      <div class="relative flex w-72 max-w-full justify-center">
        <GoalRings :value="percent" :value-class="ringClass" :left="monthly.value" :right="time.value">
          <template v-if="isDebt && targetCents !== null">
            <span class="text-xl leading-tight">{{ formatCents(targetCents - heldCents) }}</span>
            <span class="text-xs font-normal text-muted-foreground">restant à payer</span>
          </template>
          <template v-else>
            <span class="text-xl leading-tight">{{ formatCents(heldCents) }}</span>
            <span class="text-xs font-normal text-muted-foreground">mis de côté</span>
          </template>
          <span class="text-xs font-normal text-muted-foreground/80">
            {{ targetCents === null ? 'cible à définir' : `sur ${formatCents(targetCents)}` }}
          </span>
        </GoalRings>
        <span class="absolute bottom-0 left-0 flex w-20 flex-col items-start tabular-nums">
          <span class="text-sm leading-tight font-semibold">{{ monthly.label }}</span>
          <span class="text-[0.7rem] text-muted-foreground">{{ monthly.caption }}</span>
        </span>
        <span class="absolute right-0 bottom-0 flex w-20 flex-col items-end text-right tabular-nums">
          <span class="text-sm leading-tight font-semibold">{{ time.label }}</span>
          <span class="text-[0.7rem] text-muted-foreground">{{ time.caption }}</span>
        </span>
      </div>
      <!-- Updating by itself (a sync sign), or the "+" putting money aside;
           a debt has both: its sync sign and its prepayment -->
      <span class="flex items-center gap-2">
        <span
          v-if="syncTitle"
          class="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground"
          role="img"
          :aria-label="syncTitle"
          :title="syncTitle"
        >
          <RefreshCw class="size-5" />
        </span>
        <Button
          v-if="isDebt"
          size="icon"
          variant="outline"
          class="size-11 rounded-full"
          :aria-label="`Paiement anticipé : ${goal.name}`"
          title="Paiement anticipé"
          @click="emit('add')"
        >
          <HandCoins class="size-5" />
        </Button>
        <Button
          v-else-if="!syncTitle"
          size="icon"
          variant="outline"
          class="size-11 rounded-full"
          :aria-label="`Mettre de côté : ${goal.name}`"
          title="Mettre de côté"
          @click="emit('add')"
        >
          <Plus class="size-5" />
        </Button>
      </span>
    </div>

    <slot />

    <ConfirmDialog
      v-model:open="confirmOpen"
      :title="`Supprimer « ${goal.name} » ?`"
      :description="removeDescription"
      @confirm="emit('remove')"
    />
  </article>
</template>
