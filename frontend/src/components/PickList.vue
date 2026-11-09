<script setup lang="ts">
// A list to pick from, the same everywhere (the essential expenses, a debt's
// payment...): a bordered box scrolling past a few rows on a computer (a
// phone scrolls its sheet only: no scroll within a scroll), its options
// (PickOption) in the default slot. `radio`: one option, by value (v-model);
// otherwise each option ticks itself (checkboxes). `empty`: said when there is
// no option.
import { RadioGroup } from '@/components/ui/radio-group';

const model = defineModel<string | null>();
defineProps<{ radio?: boolean; label: string; empty?: string; count: number }>();

const box = 'flex min-h-0 flex-col gap-0.5 rounded-xl border p-1 md:max-h-72 md:overflow-y-auto md:overscroll-contain';
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
