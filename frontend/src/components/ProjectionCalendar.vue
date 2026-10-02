<script setup lang="ts">
// The month's projections on the shadcn calendar, with each day's projections
// in its cell; each one opens its edit dialog. The arrows step through the
// months from `min` to `max`.
import type { DateValue } from '@internationalized/date';
import type { Projection } from '@/types';
import type { Month } from '@/lib/projections';
import { computed } from 'vue';
import { CalendarDate } from '@internationalized/date';
import { CalendarRoot } from 'reka-ui';
import { formatCents } from '@/api';
import { occurrences } from '@/lib/projections';
import { cn } from '@/lib/utils';
import {
  CalendarCell,
  CalendarCellTrigger,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHead,
  CalendarGridRow,
  CalendarHeadCell,
  CalendarHeader,
  CalendarHeading,
  CalendarNextButton,
  CalendarPrevButton,
} from '@/components/ui/calendar';

const month = defineModel<Month>({ required: true });
const props = defineProps<{ projections: Projection[]; min: Month; max: Month }>();
const emit = defineEmits<{ edit: [projection: Projection] }>();

const toDate = ({ year, month }: Month, day = 1) => new CalendarDate(year, month + 1, day);

// The month shown, as the calendar's first day
const placeholder = computed({
  get: () => toDate(month.value),
  set: (d: DateValue) => {
    month.value = { year: d.year, month: d.month - 1 };
  },
});
const minValue = computed(() => toDate(props.min));
const maxValue = computed(() => toDate(props.max).add({ months: 1 }).subtract({ days: 1 }));

// The month's projections, by day
const byDay = computed(() => {
  const days = new Map<number, ReturnType<typeof occurrences>>();
  for (const o of occurrences(props.projections, month.value)) {
    days.set(o.day, [...(days.get(o.day) ?? []), o]);
  }
  return days;
});
const isShown = (d: DateValue) => d.year === month.value.year && d.month === month.value.month + 1;
</script>

<template>
  <CalendarRoot
    v-slot="{ grid, weekDays }"
    v-model:placeholder="placeholder"
    :min-value="minValue"
    :max-value="maxValue"
    locale="fr-CA"
    :week-starts-on="0"
    readonly
    class="w-full"
  >
    <CalendarHeader class="pt-0">
      <CalendarHeading class="first-letter:uppercase" />
      <nav class="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between">
        <CalendarPrevButton />
        <CalendarNextButton />
      </nav>
    </CalendarHeader>

    <CalendarGrid v-for="m in grid" :key="m.value.toString()" class="mt-3 table-fixed">
      <CalendarGridHead>
        <CalendarGridRow>
          <CalendarHeadCell v-for="day in weekDays" :key="day" class="pb-1">{{ day }}</CalendarHeadCell>
        </CalendarGridRow>
      </CalendarGridHead>
      <CalendarGridBody>
        <CalendarGridRow v-for="(week, i) in m.rows" :key="i" class="border-t">
          <CalendarCell v-for="d in week" :key="d.toString()" :date="d" class="min-w-0">
            <CalendarCellTrigger
              :day="d"
              :month="m.value"
              as="div"
              :class="
                cn(
                  'flex size-auto min-h-20 w-full flex-col items-stretch justify-start gap-1 rounded-none p-1 hover:bg-transparent',
                  // Today: its number circled, not the whole cell
                  '[&[data-today]:not([data-selected])]:bg-transparent [&[data-today]_.day]:bg-primary [&[data-today]_.day]:text-primary-foreground',
                  'data-[outside-view]:opacity-40',
                )
              "
            >
              <span class="day flex size-6 items-center justify-center self-start rounded-full text-xs tabular-nums">
                {{ d.day }}
              </span>
              <template v-if="isShown(d)">
                <button
                  v-for="o in byDay.get(d.day)"
                  :key="o.projection._id"
                  type="button"
                  :title="`${o.projection.name} · ${formatCents(o.signedCents)}`"
                  :class="
                    cn(
                      'flex min-w-0 cursor-pointer flex-col rounded px-1 py-0.5 text-left text-xs leading-tight',
                      o.signedCents < 0
                        ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                        : 'bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/20 dark:text-emerald-400',
                    )
                  "
                  @click="emit('edit', o.projection)"
                  @keydown.stop
                >
                  <span class="truncate font-medium">{{ o.projection.name }}</span>
                  <span class="hidden truncate tabular-nums sm:block">{{ formatCents(o.signedCents) }}</span>
                </button>
              </template>
            </CalendarCellTrigger>
          </CalendarCell>
        </CalendarGridRow>
      </CalendarGridBody>
    </CalendarGrid>
  </CalendarRoot>
</template>
