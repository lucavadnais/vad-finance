<script setup lang="ts">
// Category id (or null for "no category"), grouped by kind
import type { HTMLAttributes } from 'vue';
import type { Category, CategoryKind } from '@/types';
import { computed } from 'vue';
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

const model = defineModel<string | null>({ default: null });
const props = defineProps<{ categories: Category[]; class?: HTMLAttributes['class'] }>();

// Select items cannot have an empty value, so "no category" uses a sentinel
const NONE = 'none';
const value = computed({
  get: () => model.value ?? NONE,
  set: (v: string) => (model.value = v === NONE ? null : v),
});

const groups = computed(() =>
  (Object.entries(CATEGORY_KINDS) as [CategoryKind, string][])
    .map(([kind, label]) => ({ kind, label, items: props.categories.filter((c) => c.kind === kind) }))
    .filter((g) => g.items.length > 0),
);
</script>

<template>
  <Select v-model="value">
    <SelectTrigger :class="props.class">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem :value="NONE">Sans catégorie</SelectItem>
      <template v-for="g in groups" :key="g.kind">
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>{{ g.label }}</SelectLabel>
          <SelectItem v-for="c in g.items" :key="c._id" :value="c._id">{{ c.name }}</SelectItem>
        </SelectGroup>
      </template>
    </SelectContent>
  </Select>
</template>
