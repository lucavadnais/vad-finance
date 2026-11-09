<script setup lang="ts">
// A list to pick from, the same everywhere (the essential expenses, a debt's
// payment...): a bordered box scrolling past a few rows, its options
// (PickOption) in the default slot. `radio`: one option, by value (v-model);
// otherwise each option ticks itself (checkboxes). `empty`: said when there is
// no option.
import { RadioGroup } from '@/components/ui/radio-group';

const model = defineModel<string | null>();
defineProps<{ radio?: boolean; label: string; empty?: string; count: number }>();

const box = 'flex max-h-72 min-h-0 flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-xl border p-1';
</script>

<template>
  <RadioGroup v-if="radio" v-model="model" :aria-label="label" :class="box" class="gap-0.5">
    <slot />
    <p v-if="count === 0" class="p-3 text-center text-sm text-muted-foreground">{{ empty }}</p>
  </RadioGroup>
  <div v-else role="group" :aria-label="label" :class="box">
    <slot />
    <p v-if="count === 0" class="p-3 text-center text-sm text-muted-foreground">{{ empty }}</p>
  </div>
</template>
