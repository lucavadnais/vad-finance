<script setup lang="ts">
// Date field backed by a 'YYYY-MM-DD' string (the format the API uses)
import type { DateValue } from '@internationalized/date';
import type { HTMLAttributes } from 'vue';
import { computed, ref } from 'vue';
import { parseDate } from '@internationalized/date';
import { CalendarIcon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const model = defineModel<string>();
const props = defineProps<{ id?: string; class?: HTMLAttributes['class'] }>();

const open = ref(false);

const value = computed({
  get: () => (model.value ? parseDate(model.value) : undefined),
  set: (date: DateValue | undefined) => {
    model.value = date?.toString();
    open.value = false;
  },
});

const label = computed(() =>
  model.value
    ? new Date(`${model.value}T00:00:00Z`).toLocaleDateString('fr-CA', {
        timeZone: 'UTC',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Choisir une date',
);
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        :id="id"
        variant="outline"
        :class="cn('w-40 justify-start font-normal', !model && 'text-muted-foreground', props.class)"
      >
        <CalendarIcon />
        {{ label }}
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-0" align="start">
      <Calendar
        v-model="value"
        :default-placeholder="value"
        locale="fr-CA"
        layout="month-and-year"
        prevent-deselect
        initial-focus
      />
    </PopoverContent>
  </Popover>
</template>
