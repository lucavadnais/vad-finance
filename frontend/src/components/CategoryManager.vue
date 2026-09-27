<script setup lang="ts">
import type { Category, CategoryKind } from '@/types';
import { computed, ref } from 'vue';
import { X } from '@lucide/vue';
import { api } from '@/api';
import { CATEGORY_KINDS } from '@/lib/labels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import ConfirmDialog from './ConfirmDialog.vue';
import OptionSelect from './OptionSelect.vue';

const props = defineProps<{ categories: Category[] }>();
const emit = defineEmits<{ changed: []; error: [message: string] }>();

const name = ref('');
const kind = ref<CategoryKind>('expense');

const groups = computed(() =>
  (Object.entries(CATEGORY_KINDS) as [CategoryKind, string][]).map(([k, label]) => ({
    kind: k,
    label,
    items: props.categories.filter((c) => c.kind === k),
  })),
);

async function create() {
  try {
    await api.createCategory({ name: name.value, kind: kind.value });
    name.value = '';
    emit('changed');
  } catch (err) {
    emit('error', (err as Error).message);
  }
}

async function remove(category: Category) {
  try {
    await api.deleteCategory(category._id);
    emit('changed');
  } catch (err) {
    emit('error', (err as Error).message);
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Catégories</CardTitle>
      <CardDescription>Pour classer les transactions en revenus et en dépenses.</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <div v-for="g in groups" :key="g.kind" class="flex flex-wrap items-center gap-2">
        <span class="w-20 text-sm text-muted-foreground">{{ g.label }}</span>
        <span v-if="g.items.length === 0" class="text-sm text-muted-foreground">Aucune</span>
        <Badge
          v-for="c in g.items"
          :key="c._id"
          :variant="c.kind === 'income' ? 'default' : 'secondary'"
          class="gap-1 pr-1"
        >
          {{ c.name }}
          <ConfirmDialog
            :title="`Supprimer la catégorie « ${c.name} » ?`"
            description="Les transactions de cette catégorie deviendront sans catégorie."
            @confirm="remove(c)"
          >
            <button
              type="button"
              class="rounded-full p-0.5 hover:bg-black/10"
              :aria-label="`Supprimer ${c.name}`"
            >
              <X class="size-3" />
            </button>
          </ConfirmDialog>
        </Badge>
      </div>

      <form class="flex flex-wrap gap-2" @submit.prevent="create">
        <Input v-model="name" placeholder="Nouvelle catégorie" required class="w-56" />
        <OptionSelect v-model="kind" :options="CATEGORY_KINDS" class="w-32" />
        <Button type="submit">Ajouter</Button>
      </form>
    </CardContent>
  </Card>
</template>
