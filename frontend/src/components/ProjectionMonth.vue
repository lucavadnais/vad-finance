<script setup lang="ts">
// Planning of a month: its planned spending or income, and a card per
// category (BudgetOverview), the forecasts vs actual chart (of the selected
// card, or the month's income and spending); or, picked at the top instead,
// the forecasts on a calendar. "Gérer les prévisions" lists them all, to edit
// or delete. The month is shared with the month card (SpendInsights).
import type { Category, Projection, Transaction } from '@/types';
import type { Month } from '@/lib/projections';
import { addMonths, currentMonth, monthLabel } from '@/lib/projections';
import { defineAsyncComponent, ref } from 'vue';
import { CalendarDays, LayoutGrid, Target } from '@lucide/vue';
import { api } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { BudgetFocus } from './BudgetOverview.vue';
import BudgetOverview from './BudgetOverview.vue';
import ProjectionCalendar from './ProjectionCalendar.vue';
import ProjectionDialog from './ProjectionDialog.vue';
import ProjectionListDialog from './ProjectionListDialog.vue';
import PageBar from './PageBar.vue';

// Charts pull in Unovis (~1 MB): load them in their own chunk
const ProjectionsChart = defineAsyncComponent(() => import('./charts/ProjectionsChart.vue'));

const month = defineModel<Month>({ required: true });
defineProps<{
  projections: Projection[];
  transactions: Transaction[];
  categories: Category[];
}>();
const emit = defineEmits<{ changed: []; error: [message: string] }>();

// The overview, or the calendar alone (it takes room)
const view = ref<'overview' | 'calendar'>('overview');

// The budget card's arrows go anywhere: the calendar's too
const now = currentMonth();
const calendarMin = addMonths(now, -120);
const calendarMax = addMonths(now, 120);

// Card selected above, and its amounts, shown by the chart
const selected = ref<string | null>(null);
const focus = ref<BudgetFocus | null>(null);

// Dialog listing them all
const listOpen = ref(false);

// Dialog adding a projection, or editing `editing`
const dialogOpen = ref(false);
const editing = ref<Projection | null>(null);

function openDialog(p: Projection | null) {
  editing.value = p;
  dialogOpen.value = true;
}

async function remove(p: Projection) {
  try {
    await api.deleteProjection(p._id);
    emit('changed');
  } catch (err) {
    emit('error', (err as Error).message);
  }
}
</script>

<template>
  <!-- A card on a computer; flat in its tab on a phone, like the others -->
  <Card class="max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:py-0 max-md:shadow-none">
    <!-- Computer: the title (the actions are by the categories' cards). The
         month is set by the month card above (SpendInsights) -->
    <CardHeader class="max-md:hidden">
      <CardTitle class="flex min-h-8 items-center text-lg">Budget</CardTitle>
    </CardHeader>
    <!-- Phone: the page's bar, with the month -->
    <PageBar v-model:month="month" title="Budget" class="md:hidden" />
    <CardContent class="flex flex-col gap-4 max-md:px-0">
      <!-- What the card shows: the overview (total, categories, chart) or the
           forecasts on a calendar; the whole width on a phone -->
      <Tabs v-model="view">
        <TabsList class="max-md:w-full">
          <TabsTrigger value="overview" class="max-md:flex-1">
            <LayoutGrid />
            Aperçu
          </TabsTrigger>
          <TabsTrigger value="calendar" class="max-md:flex-1">
            <CalendarDays />
            Calendrier
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <template v-if="view === 'overview'">
        <!-- The month's planned total, and its categories -->
        <BudgetOverview
          v-model:selected="selected"
          v-model:focus="focus"
          :month="month"
          :projections="projections"
          :transactions="transactions"
          :categories="categories"
          @add="openDialog(null)"
          @manage="listOpen = true"
        />
        <!-- Forecasts vs actual by category, for the month shown -->
        <ProjectionsChart
          v-if="projections.length > 0"
          v-model="month"
          :projections="projections"
          :transactions="transactions"
          :categories="categories"
          :focus="focus"
        />

        <!-- Coming soon: savings goals, announced where the month is planned -->
        <div
          class="flex items-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/30 p-4 text-sm"
          aria-disabled="true"
        >
          <Target class="size-5 shrink-0 text-muted-foreground" />
          <span class="flex min-w-0 flex-col">
            <span class="font-medium">Objectifs d'épargne</span>
            <span class="text-muted-foreground"
              >Mettre de l'argent de côté pour un projet et suivre où vous en êtes.</span
            >
          </span>
          <Badge variant="secondary" class="ml-auto shrink-0">Bientôt</Badge>
        </div>
      </template>

      <!-- The month's forecasts day by day, each opening its edition -->
      <section v-else class="flex flex-col gap-3">
        <div>
          <h3 class="text-sm font-medium first-letter:uppercase">Calendrier · {{ monthLabel(month) }}</h3>
          <p class="text-sm text-muted-foreground">Touchez une prévision pour la modifier.</p>
        </div>
        <ProjectionCalendar
          v-model="month"
          :projections="projections"
          :min="calendarMin"
          :max="calendarMax"
          @edit="openDialog"
        />
      </section>

      <ProjectionListDialog
        v-model:open="listOpen"
        :projections="projections"
        :categories="categories"
        @add="openDialog(null)"
        @edit="openDialog"
        @remove="remove"
      />
      <ProjectionDialog
        v-model:open="dialogOpen"
        :categories="categories"
        :projection="editing"
        @saved="emit('changed')"
        @remove="remove"
      />
    </CardContent>
  </Card>
</template>
