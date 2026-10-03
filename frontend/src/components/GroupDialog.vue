<script setup lang="ts">
// Creates a category group, or edits `group`: name and color (its categories
// take shades of it). Opened through v-model:open.
import type { CategoryGroup } from '@/types';
import { computed, ref, watch } from 'vue';
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
import CategoryColorPicker from './CategoryColorPicker.vue';

const open = defineModel<boolean>('open', { required: true });
const props = defineProps<{ group?: CategoryGroup | null }>();
const emit = defineEmits<{ saved: [group: CategoryGroup] }>();

const editing = computed(() => !!props.group);
const name = ref('');
// null: the backend draws a color
const color = ref<string | null>(null);
const saving = ref(false);
const error = ref('');

// Every opening starts from the group, or an empty form
watch(open, (value) => {
  if (!value) return;
  name.value = props.group?.name ?? '';
  color.value = props.group?.color ?? null;
  error.value = '';
});

function onOpenChange(value: boolean) {
  if (!saving.value) open.value = value;
}

async function submit() {
  saving.value = true;
  error.value = '';
  try {
    const body = { name: name.value, color: color.value };
    const saved = props.group
      ? await api.updateCategoryGroup(props.group._id, body)
      : await api.createCategoryGroup(body);
    open.value = false;
    emit('saved', saved);
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
          <DialogTitle>{{ editing ? 'Modifier le groupe' : 'Nouveau groupe' }}</DialogTitle>
          <DialogDescription>
            Rassemble plusieurs catégories pour l'analyse. Elles prennent des nuances de sa couleur.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div class="flex flex-col gap-2">
            <Label for="group-name">Nom</Label>
            <Input id="group-name" v-model="name" placeholder="Milieu de vie" required />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="group-color">Couleur</Label>
            <CategoryColorPicker id="group-color" v-model="color" class="w-36" />
          </div>

          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="saving" @click="onOpenChange(false)">Annuler</Button>
          <Button type="submit" :disabled="saving">
            {{ saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer le groupe' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
