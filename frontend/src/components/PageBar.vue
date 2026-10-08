<script setup lang="ts" generic="P extends string">
// The bar at the top of each page (each tab on a phone), stuck to the top of
// the screen while the page scrolls by. On the left, the page's title, or a
// back button; on the right, what the page is scoped by: a period picker
// (`periods`, v-model:period), the month's arrows (v-model:month), or both.
// With both, the arrows show for the "Mois par mois" period only, on a second
// line on a phone. Actions stay out of it, in the page.
// The parent decides where it shows (e.g. `md:hidden` where the cards have
// their own headers on a computer).
import type { Month } from '@/lib/projections';
import { computed } from 'vue';
import { ArrowLeft } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import MonthStepper from './MonthStepper.vue';
import OptionSelect from './OptionSelect.vue';

const props = defineProps<{
  title?: string;
  // A back button instead of the title
  back?: boolean;
  periods?: Record<P, string>;
  // The arrows stop at the current month (past data only)
  upToNow?: boolean;
}>();
const emit = defineEmits<{ back: [] }>();
const period = defineModel<P>('period');
const month = defineModel<Month>('month');

const showMonth = computed(() => month.value !== undefined && (!props.periods || period.value === 'month'));
// Period and month together: the arrows on their own line on a phone
const both = computed(() => !!props.periods && showMonth.value);
</script>

<template>
  <div
    class="sticky top-0 z-30 -mx-4 flex min-h-13 flex-wrap items-center gap-2 bg-background/90 px-4 py-2 text-sm font-medium backdrop-blur"
  >
    <!-- On a phone, "Retour" is an arrow only, so the rest fits beside it -->
    <Button
      v-if="back"
      variant="ghost"
      size="sm"
      class="-ml-2 shrink-0 max-md:size-9"
      aria-label="Retour"
      @click="emit('back')"
    >
      <ArrowLeft />
      <span class="max-md:sr-only">Retour</span>
    </Button>
    <h2 v-else-if="title" class="truncate text-lg font-semibold">{{ title }}</h2>

    <MonthStepper
      v-if="showMonth && month"
      v-model="month"
      :up-to-now="upToNow"
      :short-on-narrow="!both"
      :class="both ? 'max-md:order-last max-md:w-full max-md:justify-center md:ml-auto' : 'ml-auto'"
    />
    <OptionSelect
      v-if="periods"
      v-model="period"
      :options="periods"
      class="w-auto shrink-0 font-normal"
      :class="both ? 'max-md:ml-auto' : 'ml-auto'"
    />
  </div>
</template>
