<script setup lang="ts">
// Form creating or editing a projected expense or an amount to receive, in the
// projection dialog
import type { Category, CategoryKind, Projection, ProjectionInput, Recurrence } from '@/types';
import { computed, ref, watch } from 'vue';
import { api, toCents, toDateInput } from '@/api';
import { MONTHS, PROJECTION_KINDS, RECURRENCES } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CategorySelect from './CategorySelect.vue';
import DatePicker from './DatePicker.vue';
import OptionSelect from './OptionSelect.vue';

const props = defineProps<{
  categories: Category[];
  // The one to edit, or null to create one
  projection: Projection | null;
}>();
const emit = defineEmits<{ saved: []; cancel: [] }>();

const MONTH_OPTIONS = Object.fromEntries(MONTHS.map((label, i) => [String(i + 1), label])) as Record<
  string,
  string
>;

const kind = ref<CategoryKind>('expense');
const name = ref('');
const amount = ref('');
const day = ref('1');
const recurrence = ref<Recurrence>('monthly');
const month = ref('1');
const year = ref('');
const category = ref<string | null>(null);
// Repeating ones may stop after a date ('YYYY-MM-DD')
const hasEnd = ref(false);
const endDate = ref<string | undefined>();

const saving = ref(false);
const error = ref('');

// Starts from the edited projection, or an empty form (the dialog mounts the
// form on each opening)
function reset() {
  const p = props.projection;
  const now = new Date();
  kind.value = p?.kind ?? 'expense';
  name.value = p?.name ?? '';
  amount.value = p ? String(p.amountCents / 100).replace('.', ',') : '';
  day.value = String(p?.dayOfMonth ?? now.getDate());
  recurrence.value = p?.recurrence ?? 'monthly';
  month.value = String(p?.month ?? now.getMonth() + 1);
  year.value = String(p?.year ?? now.getFullYear());
  category.value = p?.category ?? null;
  hasEnd.value = !!p?.endDate;
  // Defaults to a year from now
  endDate.value = p?.endDate
    ? toDateInput(p.endDate)
    : new Date(Date.UTC(now.getFullYear() + 1, now.getMonth(), now.getDate())).toISOString().slice(0, 10);
  error.value = '';
}
reset();

// Only the categories of the same kind: expense ones for an expense
const kindCategories = computed(() => props.categories.filter((c) => c.kind === kind.value));
watch(kind, () => {
  if (category.value && !kindCategories.value.some((c) => c._id === category.value)) category.value = null;
});
// Picking a category names the projection after it, unless it already has a name
watch(category, (id) => {
  const c = props.categories.find((c) => c._id === id);
  if (c && !name.value.trim()) name.value = c.name;
});

async function submit() {
  const amountCents = Math.abs(toCents(amount.value));
  const dayOfMonth = Number(day.value);
  if (Number.isNaN(amountCents)) {
    error.value = 'Montant invalide';
    return;
  }
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    error.value = 'Le jour doit être entre 1 et 31';
    return;
  }
  const body: ProjectionInput = {
    name: name.value,
    kind: kind.value,
    amountCents,
    dayOfMonth,
    recurrence: recurrence.value,
    month: recurrence.value === 'monthly' ? null : Number(month.value),
    year: recurrence.value === 'once' ? Number(year.value) : null,
    endDate: recurrence.value !== 'once' && hasEnd.value ? (endDate.value ?? null) : null,
    category: category.value,
  };
  saving.value = true;
  error.value = '';
  try {
    if (props.projection) await api.updateProjection(props.projection._id, body);
    else await api.createProjection(body);
    emit('saved');
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="submit">
    <Tabs v-model="kind">
      <TabsList class="w-full">
        <TabsTrigger v-for="(label, value) in PROJECTION_KINDS" :key="value" :value="value">
          {{ label }}
        </TabsTrigger>
      </TabsList>
    </Tabs>

    <div class="flex flex-col gap-2">
      <Label for="projection-category">Catégorie (facultatif)</Label>
      <CategorySelect id="projection-category" v-model="category" :categories="kindCategories" class="w-full" />
    </div>

    <div class="flex flex-col gap-2">
      <Label for="projection-name">Nom</Label>
      <Input
        id="projection-name"
        v-model="name"
        :placeholder="kind === 'expense' ? 'Loyer' : 'Remboursement de Marc'"
        required
      />
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div class="flex flex-col gap-2">
        <Label for="projection-amount">Montant</Label>
        <Input id="projection-amount" v-model="amount" inputmode="decimal" placeholder="0,00" required />
      </div>
      <div class="flex flex-col gap-2">
        <Label for="projection-day">Jour du mois</Label>
        <Input id="projection-day" v-model="day" type="number" min="1" max="31" required />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div class="flex flex-col gap-2" :class="recurrence === 'monthly' && 'col-span-2'">
        <Label for="projection-recurrence">Récurrence</Label>
        <OptionSelect id="projection-recurrence" v-model="recurrence" :options="RECURRENCES" class="w-full" />
      </div>
      <div v-if="recurrence !== 'monthly'" class="flex flex-col gap-2">
        <Label for="projection-month">Mois</Label>
        <OptionSelect id="projection-month" v-model="month" :options="MONTH_OPTIONS" class="w-full" />
      </div>
      <div v-if="recurrence === 'once'" class="col-start-2 flex flex-col gap-2">
        <Label for="projection-year">Année</Label>
        <Input id="projection-year" v-model="year" type="number" min="2000" max="2100" required />
      </div>
    </div>
    <p v-if="Number(day) > 28" class="-mt-2 text-xs text-muted-foreground">
      Les mois plus courts, elle tombe le dernier jour du mois.
    </p>

    <div v-if="recurrence !== 'once'" class="flex min-h-9 flex-wrap items-center gap-3">
      <Switch id="projection-has-end" v-model="hasEnd" />
      <Label for="projection-has-end" class="font-normal">Date de fin</Label>
      <DatePicker v-if="hasEnd" v-model="endDate" class="ml-auto w-44" />
    </div>

    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

    <div class="flex justify-end gap-2">
      <Button type="button" variant="outline" :disabled="saving" @click="emit('cancel')">
        Annuler
      </Button>
      <Button type="submit" :disabled="saving">
        {{ saving ? 'Enregistrement…' : projection ? 'Enregistrer' : 'Ajouter' }}
      </Button>
    </div>
  </form>
</template>
