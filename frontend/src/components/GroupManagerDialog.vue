<script setup lang="ts">
// "Modifier les groupes" link and the dialog renaming or deleting each group
import type { Category, CategoryGroup } from '@/types';
import { nextTick, ref } from 'vue';
import { Check, Pencil, Trash2, X } from '@lucide/vue';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import ConfirmDialog from './ConfirmDialog.vue';

const props = defineProps<{ groups: CategoryGroup[]; categories: Category[] }>();
const emit = defineEmits<{ changed: [] }>();

const countIn = (group: CategoryGroup) => props.categories.filter((c) => c.group === group._id).length;

// One group renamed at a time
const editingId = ref<string | null>(null);
const editName = ref('');
const saving = ref(false);
const error = ref('');

function onOpenChange() {
  editingId.value = null;
  error.value = '';
}

async function startEdit(group: CategoryGroup) {
  editingId.value = group._id;
  editName.value = group.name;
  error.value = '';
  await nextTick();
  document.getElementById(`group-edit-${group._id}`)?.focus();
}

async function run(action: () => Promise<unknown>) {
  saving.value = true;
  error.value = '';
  try {
    await action();
    emit('changed');
    return true;
  } catch (err) {
    error.value = (err as Error).message;
    return false;
  } finally {
    saving.value = false;
  }
}

async function saveEdit(group: CategoryGroup) {
  if (editName.value.trim() === group.name) {
    editingId.value = null;
    return;
  }
  if (await run(() => api.updateCategoryGroup(group._id, { name: editName.value }))) {
    editingId.value = null;
  }
}

const remove = (group: CategoryGroup) => run(() => api.deleteCategoryGroup(group._id));
</script>

<template>
  <Dialog @update:open="onOpenChange">
    <DialogTrigger as-child>
      <button type="button" class="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        Modifier les groupes
      </button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Groupes</DialogTitle>
        <DialogDescription>
          Supprimer un groupe conserve ses catégories, sans groupe.
        </DialogDescription>
      </DialogHeader>

      <p v-if="groups.length === 0" class="text-sm text-muted-foreground">Aucun groupe</p>
      <ul v-else class="flex max-h-96 flex-col gap-1 overflow-y-auto">
        <li v-for="g in groups" :key="g._id" class="flex min-h-9 items-center gap-2">
          <form v-if="editingId === g._id" class="flex flex-1 items-center gap-1" @submit.prevent="saveEdit(g)">
            <Input
              :id="`group-edit-${g._id}`"
              v-model="editName"
              required
              :aria-label="`Nouveau nom de ${g.name}`"
              class="h-8"
              @keydown.esc.stop="editingId = null"
            />
            <Button type="submit" size="icon-sm" :disabled="saving" aria-label="Enregistrer">
              <Check />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              :disabled="saving"
              aria-label="Annuler"
              @click="editingId = null"
            >
              <X />
            </Button>
          </form>
          <template v-else>
            <span class="flex-1 text-sm">
              {{ g.name }}
              <span class="text-muted-foreground">· {{ countIn(g) }}</span>
            </span>
            <Button size="icon-sm" variant="ghost" :disabled="saving" :aria-label="`Renommer ${g.name}`" @click="startEdit(g)">
              <Pencil />
            </Button>
            <ConfirmDialog
              :title="`Supprimer le groupe « ${g.name} » ?`"
              description="Ses catégories sont conservées, sans groupe."
              @confirm="remove(g)"
            >
              <Button size="icon-sm" variant="ghost" :disabled="saving" :aria-label="`Supprimer ${g.name}`">
                <Trash2 />
              </Button>
            </ConfirmDialog>
          </template>
        </li>
      </ul>

      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
    </DialogContent>
  </Dialog>
</template>
