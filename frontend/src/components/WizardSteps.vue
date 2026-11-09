<script lang="ts">
// A choice of a wizard step as a card, outlined once picked: a <label> around
// a RadioGroupItem
export const CHOICE_CARD =
  'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/60 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5';
</script>

<script setup lang="ts">
// A wizard's stepper: one numbered dot per step (a check once passed), the
// current one's label (all of them from a tablet), joined by lines of the
// same length. Any step
// can be picked. v-model: the current step's index, in `steps`. `choice`: the
// first step is the choice the others follow from (how the target is set, a
// goal's kind): no stepper on it, and the others numbered from 1 ("Retour"
// leads back to it).
import { computed } from 'vue';
import { Check } from '@lucide/vue';

const index = defineModel<number>({ required: true });
const props = defineProps<{ steps: string[]; choice?: boolean }>();

const offset = computed(() => (props.choice ? 1 : 0));
const shown = computed(() => props.steps.slice(offset.value));
// The current step among those shown
const at = computed(() => index.value - offset.value);
// A grid: each step as wide as it needs, the lines between them sharing what
// is left evenly, however long the labels
const columns = computed(() => shown.value.map(() => 'auto').join(' minmax(1rem, 1fr) '));
</script>

<template>
  <ol v-if="at >= 0 && shown.length > 1" class="grid items-center gap-2" :style="{ gridTemplateColumns: columns }">
    <!-- Each step's button and the line after it, cells of the grid -->
    <li v-for="(label, i) in shown" :key="label" class="contents">
      <button
        type="button"
        class="flex shrink-0 items-center gap-1.5 text-xs font-medium"
        :class="i > at && 'text-muted-foreground'"
        :aria-current="i === at ? 'step' : undefined"
        @click="index = i + offset"
      >
        <span
          class="flex size-6 items-center justify-center rounded-full font-semibold"
          :class="
            i < at
              ? 'bg-primary text-primary-foreground'
              : i === at
                ? 'border-2 border-primary text-primary'
                : 'border border-muted-foreground/30'
          "
        >
          <Check v-if="i < at" class="size-3.5" />
          <template v-else>{{ i + 1 }}</template>
        </span>
        <span :class="i !== at && 'max-sm:hidden'">{{ label }}</span>
      </button>
      <span v-if="i < shown.length - 1" class="h-px bg-border" />
    </li>
  </ol>
</template>
