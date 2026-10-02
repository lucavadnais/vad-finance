<script setup lang="ts">
// Dialog adding a projection, or editing `projection`; opened by the parent
// through v-model:open
import type { Category, Projection } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ProjectionForm from './ProjectionForm.vue';

const open = defineModel<boolean>('open', { required: true });
defineProps<{ categories: Category[]; projection: Projection | null }>();
const emit = defineEmits<{ saved: [] }>();

function onSaved() {
  open.value = false;
  emit('saved');
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ projection ? `Modifier « ${projection.name} »` : 'Nouvelle prévision' }}</DialogTitle>
        <DialogDescription>
          Une dépense qui revient (loyer, abonnement, assurance…) ou de l'argent qu'on te doit.
        </DialogDescription>
      </DialogHeader>
      <ProjectionForm :categories="categories" :projection="projection" @saved="onSaved" @cancel="open = false" />
    </DialogContent>
  </Dialog>
</template>
