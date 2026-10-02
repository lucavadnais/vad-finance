<script setup lang="ts">
// Dialog listing every projection once, with its next date, to edit or delete
import type { Category, Projection } from '@/types';
import type { ProjectionRow } from './ProjectionTable.vue';
import { computed } from 'vue';
import { formatDate } from '@/api';
import { nextDate } from '@/lib/projections';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ProjectionTable from './ProjectionTable.vue';

const open = defineModel<boolean>('open', { required: true });
const props = defineProps<{ projections: Projection[]; categories: Category[] }>();
const emit = defineEmits<{ edit: [projection: Projection]; remove: [projection: Projection] }>();

const rows = computed<ProjectionRow[]>(() =>
  props.projections.map((p) => {
    const next = nextDate(p);
    return {
      projection: p,
      date: next && formatDate(next),
      signedCents: p.kind === 'expense' ? -p.amountCents : p.amountCents,
    };
  }),
);
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Prévisions</DialogTitle>
        <DialogDescription>Chaque dépense prévue et compte à recevoir, avec sa prochaine date.</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <ProjectionTable
          :rows="rows"
          :categories="categories"
          date-label="Prochaine"
          editable
          @edit="emit('edit', $event)"
          @remove="emit('remove', $event)"
        />
      </DialogBody>
    </DialogContent>
  </Dialog>
</template>
