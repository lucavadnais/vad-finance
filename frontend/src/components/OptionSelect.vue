<script setup lang="ts" generic="T extends string">
// shadcn Select for a fixed list of options given as { value: label }
import type { HTMLAttributes } from 'vue';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const model = defineModel<T>();
const props = withDefaults(
  defineProps<{
    options: Record<T, string>;
    placeholder?: string;
    class?: HTMLAttributes['class'];
  }>(),
  { placeholder: 'Choisir…' },
);
</script>

<template>
  <Select v-model="model">
    <SelectTrigger :class="props.class">
      <SelectValue :placeholder="placeholder" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem v-for="(label, value) in options" :key="value" :value="value">
        {{ label }}
      </SelectItem>
    </SelectContent>
  </Select>
</template>
