<script setup lang="ts">
// Every how many weeks, months or years: "Chaque [1] mois", "Aux [2]
// semaines". v-model: the number, as typed (1 to 99).
import type { Recurrence } from '@/types';
import { computed } from 'vue';
import { RECURRENCE_UNITS } from '@/lib/labels';
import { Input } from '@/components/ui/input';

const interval = defineModel<string>({ required: true });
const props = defineProps<{ recurrence: Exclude<Recurrence, 'once'>; id?: string }>();

const many = computed(() => Number(interval.value) > 1);
const unit = computed(() => RECURRENCE_UNITS[props.recurrence][many.value ? 1 : 0]);
</script>

<template>
  <div class="flex items-center gap-2">
    <span class="text-sm">{{ many ? 'Aux' : 'Chaque' }}</span>
    <Input :id="id" v-model="interval" type="number" min="1" max="99" class="w-16" required />
    <span class="text-sm">{{ unit }}</span>
  </div>
</template>
