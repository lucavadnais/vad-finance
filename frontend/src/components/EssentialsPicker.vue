<script setup lang="ts">
// Ticks the essential expenses, those the emergency fund must cover: the
// expense groups (their categories follow them) and the categories without a
// group, in a PickList. `ticked` holds the choice by group or category id;
// the parent saves it on the fund.
import type { Category, CategoryGroup } from '@/types';
import { computed } from 'vue';
import CategoryDot from './CategoryDot.vue';
import PickList from './PickList.vue';
import PickOption from './PickOption.vue';

const ticked = defineModel<Record<string, boolean>>({ required: true });
const props = defineProps<{ categories: Category[]; groups: CategoryGroup[]; colors: Map<string, string> }>();

const expenses = computed(() => props.categories.filter((c) => c.kind === 'expense' && !c.archived));
// Groups holding an expense category, with those categories' names under them
const groupRows = computed(() =>
  props.groups
    .map((g) => ({ group: g, names: expenses.value.filter((c) => c.group === g._id).map((c) => c.name) }))
    .filter((r) => r.names.length > 0),
);
const ungrouped = computed(() => expenses.value.filter((c) => !c.group));
</script>

<template>
  <PickList label="Dépenses essentielles" :count="expenses.length" empty="Aucune catégorie de dépense pour l'instant.">
    <PickOption v-for="{ group, names } in groupRows" :key="group._id" v-model:checked="ticked[group._id]">
      <CategoryDot :color="group.color" />
      <span class="flex min-w-0 flex-col">
        <span class="font-medium">{{ group.name }}</span>
        <span class="text-muted-foreground">{{ names.join(', ') }}</span>
      </span>
    </PickOption>
    <PickOption v-for="c in ungrouped" :key="c._id" v-model:checked="ticked[c._id]">
      <CategoryDot :color="colors.get(c._id)" />
      <span class="font-medium">{{ c.name }}</span>
    </PickOption>
  </PickList>
</template>
