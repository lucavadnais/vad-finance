<script setup lang="ts">
// Dialog creating a category group; opened by the parent through v-model:open
import type { CategoryGroup } from '@/types';
import { ref, watch } from 'vue';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{ created: [group: CategoryGroup] }>();

const name = ref('');
const saving = ref(false);
const error = ref('');

// Every opening starts from an empty form
watch(open, (value) => {
  if (!value) return;
  name.value = '';
  error.value = '';
});

function onOpenChange(value: boolean) {
  if (!saving.value) open.value = value;
}

async function submit() {
  saving.value = true;
  error.value = '';
  try {
    const group = await api.createCategoryGroup({ name: name.value });
    open.value = false;
    emit('created', group);
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-sm">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>Nouveau groupe</DialogTitle>
          <DialogDescription>Rassemble plusieurs catégories pour l'analyse.</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div class="flex flex-col gap-2">
            <Label for="group-name">Nom</Label>
            <Input id="group-name" v-model="name" placeholder="Milieu de vie" required />
          </div>

          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="saving" @click="onOpenChange(false)">
            Annuler
          </Button>
          <Button type="submit" :disabled="saving">{{ saving ? 'Création…' : 'Créer le groupe' }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
