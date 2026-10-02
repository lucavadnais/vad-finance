<script setup lang="ts">
// Form creating or editing a projected expense or an amount to receive, in the
// projection dialog
import type { Category, CategoryKind, Projection, ProjectionInput, Recurrence } from '@/types';
import { computed, ref, watch } from 'vue';
import { api, toCents, toDateInput } from '@/api';
import { PROJECTION_KINDS, RECURRENCE_UNITS, RECURRENCES } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import { DialogBody, DialogFooter } from '@/components/ui/dialog';
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

const kind = ref<CategoryKind>('expense');
const name = ref('');
const amount = ref('');
const recurrence = ref<Recurrence>('monthly');
// Every how many weeks, months or years
const interval = ref('1');
// First day it lands on ('YYYY-MM-DD')
const startDate = ref<string | undefined>();
const category = ref<string | null>(null);
// Repeating ones may stop after a date ('YYYY-MM-DD')
const hasEnd = ref(false);
const endDate = ref<string | undefined>();

const saving = ref(false);
const error = ref('');

const isoDay = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);

// Starts from the edited projection, or an empty form (the dialog mounts the
// form on each opening)
function reset() {
  const p = props.projection;
  const now = new Date();
  kind.value = p?.kind ?? 'expense';
  name.value = p?.name ?? '';
  amount.value = p ? String(p.amountCents / 100).replace('.', ',') : '';
  recurrence.value = p?.recurrence ?? 'monthly';
  interval.value = String(p?.interval ?? 1);
  startDate.value = p ? toDateInput(p.startDate) : isoDay(now.getFullYear(), now.getMonth(), now.getDate());
  category.value = p?.category ?? null;
  hasEnd.value = !!p?.endDate;
  // Defaults to a year from now
  endDate.value = p?.endDate
    ? toDateInput(p.endDate)
    : isoDay(now.getFullYear() + 1, now.getMonth(), now.getDate());
  error.value = '';
}
reset();

const unit = computed(() => {
  if (recurrence.value === 'once') return '';
  const [one, many] = RECURRENCE_UNITS[recurrence.value];
  return Number(interval.value) > 1 ? many : one;
});
const startDay = computed(() => Number(startDate.value?.slice(8, 10)));

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
  const every = recurrence.value === 'once' ? 1 : Number(interval.value);
  if (Number.isNaN(amountCents)) {
    error.value = 'Montant invalide';
    return;
  }
  if (!Number.isInteger(every) || every < 1 || every > 99) {
    error.value = 'L’intervalle doit être entre 1 et 99';
    return;
  }
  if (!startDate.value) {
    error.value = 'Choisis une date';
    return;
  }
  const body: ProjectionInput = {
    name: name.value,
    kind: kind.value,
    amountCents,
    recurrence: recurrence.value,
    interval: every,
    startDate: startDate.value,
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
    <DialogBody>
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
          <Label for="projection-recurrence">Récurrence</Label>
          <OptionSelect id="projection-recurrence" v-model="recurrence" :options="RECURRENCES" class="w-full" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div v-if="recurrence !== 'once'" class="flex flex-col gap-2">
          <Label for="projection-interval">Fréquence</Label>
          <div class="flex items-center gap-2">
            <span class="text-sm">{{ Number(interval) > 1 ? 'Aux' : 'Chaque' }}</span>
            <Input id="projection-interval" v-model="interval" type="number" min="1" max="99" class="w-16" required />
            <span class="text-sm">{{ unit }}</span>
          </div>
        </div>
        <div class="flex flex-col gap-2" :class="recurrence === 'once' && 'col-span-2'">
          <Label>{{ recurrence === 'once' ? 'Date' : 'À partir du' }}</Label>
          <DatePicker v-model="startDate" class="w-full" />
        </div>
      </div>
      <p v-if="recurrence !== 'once' && startDay > 28 && recurrence !== 'weekly'" class="-mt-2 text-xs text-muted-foreground">
        Les mois plus courts, elle tombe le dernier jour du mois.
      </p>

      <div v-if="recurrence !== 'once'" class="flex min-h-9 flex-wrap items-center gap-3">
        <Switch id="projection-has-end" v-model="hasEnd" />
        <Label for="projection-has-end" class="font-normal">Date de fin</Label>
        <DatePicker v-if="hasEnd" v-model="endDate" class="ml-auto w-44" />
      </div>

      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
    </DialogBody>

    <DialogFooter>
      <Button type="button" variant="outline" :disabled="saving" @click="emit('cancel')">
        Annuler
      </Button>
      <Button type="submit" :disabled="saving">
        {{ saving ? 'Enregistrement…' : projection ? 'Enregistrer' : 'Ajouter' }}
      </Button>
    </DialogFooter>
  </form>
</template>
