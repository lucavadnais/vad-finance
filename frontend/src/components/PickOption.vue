<script setup lang="ts">
// One option of a PickList: its control on the left - a radio with `value`
// (in a radio list), else a checkbox (v-model:checked) - then what it is
// (default slot) and, on the right, a figure (`end` slot, e.g. an amount).
// The whole row picks it, tinted once picked.
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroupItem } from '@/components/ui/radio-group';

const checked = defineModel<boolean>('checked');
defineProps<{ value?: string }>();
</script>

<template>
  <label
    class="flex cursor-pointer items-center gap-3 rounded-lg p-2 text-sm transition-colors hover:bg-muted has-[[data-state=checked]]:bg-primary/5"
  >
    <RadioGroupItem v-if="value !== undefined" :value="value" />
    <Checkbox v-else v-model="checked" />
    <span class="flex min-w-0 flex-1 items-center gap-2">
      <slot />
    </span>
    <span v-if="$slots.end" class="shrink-0 tabular-nums">
      <slot name="end" />
    </span>
  </label>
</template>
