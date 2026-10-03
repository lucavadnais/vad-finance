<script lang="ts">
// Model value meaning "transfer between own accounts" (with `allow-transfer`)
export const TRANSFER = 'transfer';
</script>

<script setup lang="ts">
// Category id (or null for "no category"), grouped by kind
import type { HTMLAttributes } from 'vue';
import type { Category, CategoryKind } from '@/types';
import { computed } from 'vue';
import { Settings2 } from '@lucide/vue';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CATEGORY_KINDS } from '@/lib/labels';
import { useFinanceData } from '@/composables/useFinanceData';
import { useSettings } from '@/composables/useSettings';
import CategoryDot from './CategoryDot.vue';

const model = defineModel<string | null>({ default: null });
const props = defineProps<{
  categories: Category[];
  // Adds a "Transfert" choice, for transactions between own accounts
  allowTransfer?: boolean;
  id?: string;
  class?: HTMLAttributes['class'];
}>();

const { categoryColors } = useFinanceData();

// Select items cannot have an empty value, so "no category" uses a sentinel
const NONE = 'none';
// Last item: opens the settings on the categories, without changing the value
const MANAGE = 'manage';
const { openSettings } = useSettings();
const value = computed({
  get: () => model.value ?? NONE,
  set: (v: string) => {
    if (v === MANAGE) openSettings('categories');
    else model.value = v === NONE ? null : v;
  },
});

// Archived categories are not offered, except the one already picked (editing
// a past transaction keeps showing its category)
const offered = computed(() => props.categories.filter((c) => !c.archived || c._id === model.value));

const groups = computed(() =>
  (Object.entries(CATEGORY_KINDS) as [CategoryKind, string][])
    .map(([kind, label]) => ({ kind, label, items: offered.value.filter((c) => c.kind === kind) }))
    .filter((g) => g.items.length > 0),
);
</script>

<template>
  <Select v-model="value">
    <SelectTrigger :id="id" :class="props.class">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem :value="NONE">Sans catégorie</SelectItem>
      <template v-for="g in groups" :key="g.kind">
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>{{ g.label }}</SelectLabel>
          <SelectItem v-for="c in g.items" :key="c._id" :value="c._id">
            <CategoryDot :color="categoryColors.get(c._id)" />
            {{ c.name }}
            <span v-if="c.archived" class="text-muted-foreground">(archivée)</span>
          </SelectItem>
        </SelectGroup>
      </template>
      <template v-if="allowTransfer">
        <SelectSeparator />
        <SelectItem :value="TRANSFER">Transfert</SelectItem>
      </template>
      <SelectSeparator />
      <SelectItem :value="MANAGE" class="text-muted-foreground">
        <Settings2 />
        Gérer les catégories…
      </SelectItem>
    </SelectContent>
  </Select>
</template>
