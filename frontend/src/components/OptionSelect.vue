<script setup lang="ts" generic="T extends string">
// shadcn Select for a fixed list of options given as { value: label }, each
// with its color dot when `colors` gives one (e.g. category groups)
import type { HTMLAttributes } from 'vue';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CategoryDot from './CategoryDot.vue';

const model = defineModel<T>();
const props = withDefaults(
  defineProps<{
    options: Record<T, string>;
    colors?: Record<string, string>;
    placeholder?: string;
    id?: string;
    class?: HTMLAttributes['class'];
  }>(),
  { placeholder: 'Choisir…' },
);
</script>

<template>
  <Select v-model="model">
    <SelectTrigger :id="id" :class="props.class">
      <SelectValue :placeholder="placeholder" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem v-for="(label, value) in options" :key="value" :value="value">
        <CategoryDot v-if="colors?.[String(value)]" :color="colors[String(value)]" />
        {{ label }}
      </SelectItem>
      <!-- Extra items after the options (e.g. a separator and an action) -->
      <slot name="after" />
    </SelectContent>
  </Select>
</template>
