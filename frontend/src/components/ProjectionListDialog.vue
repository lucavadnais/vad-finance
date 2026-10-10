<script setup lang="ts">
// Dialog listing every projection once, to edit or delete (ProjectionList),
// and adding one (`add`).
// Its content is created on each opening: the search starts empty.
import type { Category, Projection } from '@/types';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import ProjectionList from './ProjectionList.vue';

const open = defineModel<boolean>('open', { required: true });
defineProps<{ projections: Projection[]; categories: Category[] }>();
const emit = defineEmits<{ add: []; edit: [projection: Projection]; remove: [projection: Projection] }>();
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Prévisions</DialogTitle>
        <DialogDescription>Chaque dépense prévue et compte à recevoir, avec sa prochaine date.</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <ProjectionList
          :projections="projections"
          :categories="categories"
          @edit="emit('edit', $event)"
          @remove="emit('remove', $event)"
        >
          <template #actions>
            <!-- Icon only on a phone, so the search keeps its room -->
            <Button
              class="shrink-0 max-sm:size-9"
              aria-label="Ajouter une prévision"
              title="Ajouter une prévision"
              @click="emit('add')"
            >
              <Plus />
              <span class="max-sm:sr-only">Prévision</span>
            </Button>
          </template>
        </ProjectionList>
      </DialogBody>
    </DialogContent>
  </Dialog>
</template>
