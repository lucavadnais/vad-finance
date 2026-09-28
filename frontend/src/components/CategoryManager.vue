<script setup lang="ts">
import type { Category, CategoryGroup, CategoryKind } from '@/types';
import { computed, ref } from 'vue';
import { Trash2, X } from '@lucide/vue';
import { api } from '@/api';
import { CATEGORY_KINDS } from '@/lib/labels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import ConfirmDialog from './ConfirmDialog.vue';
import OptionSelect from './OptionSelect.vue';

const props = defineProps<{ categories: Category[]; groups: CategoryGroup[] }>();
const emit = defineEmits<{ changed: []; error: [message: string] }>();

// Select items cannot have an empty value, so "no group" uses a sentinel
const NO_GROUP = 'none';
const groupOptions = computed(() => ({
  [NO_GROUP]: 'Aucun groupe',
  ...Object.fromEntries(props.groups.map((g) => [g._id, g.name])),
}));

const sorted = computed(() =>
  [...props.categories].sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, 'fr'),
  ),
);
const countIn = (group: CategoryGroup) => props.categories.filter((c) => c.group === group._id).length;

// Table display: one flat list, or a section per group (then "Sans groupe")
const byGroup = ref(true);
const sections = computed(() => {
  if (!byGroup.value || props.groups.length === 0) {
    return [{ key: 'all', title: null as string | null, items: sorted.value }];
  }
  const groups = [...props.groups].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return [
    ...groups.map((g) => ({ key: g._id, title: g.name, items: sorted.value.filter((c) => c.group === g._id) })),
    { key: NO_GROUP, title: 'Sans groupe', items: sorted.value.filter((c) => !c.group) },
  ].filter((section) => section.items.length > 0 || section.key !== NO_GROUP);
});

const name = ref('');
const kind = ref<CategoryKind>('expense');
const group = ref<string>(NO_GROUP);
const groupName = ref('');

async function run(action: () => Promise<unknown>) {
  try {
    await action();
    emit('changed');
  } catch (err) {
    emit('error', (err as Error).message);
  }
}

const createCategory = () =>
  run(async () => {
    await api.createCategory({
      name: name.value,
      kind: kind.value,
      group: group.value === NO_GROUP ? null : group.value,
    });
    name.value = '';
  });

const setGroup = (category: Category, value: string | undefined) =>
  run(() => api.updateCategory(category._id, { group: !value || value === NO_GROUP ? null : value }));

const removeCategory = (category: Category) => run(() => api.deleteCategory(category._id));

const createGroup = () =>
  run(async () => {
    await api.createCategoryGroup({ name: groupName.value });
    groupName.value = '';
  });

const removeGroup = (g: CategoryGroup) => run(() => api.deleteCategoryGroup(g._id));
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Catégories</CardTitle>
      <CardDescription>
        Pour classer les transactions en revenus et en dépenses. Les groupes rassemblent plusieurs
        catégories (ex. Électricité et Internet dans « Milieu de vie ») pour l'analyse.
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-6">
      <div class="flex flex-col gap-3">
        <h3 class="text-sm font-medium">Groupes</h3>
        <div class="flex flex-wrap items-center gap-2">
          <span v-if="groups.length === 0" class="text-sm text-muted-foreground">Aucun groupe</span>
          <Badge v-for="g in groups" :key="g._id" variant="outline" class="gap-1 pr-1">
            {{ g.name }}
            <span class="text-muted-foreground">· {{ countIn(g) }}</span>
            <ConfirmDialog
              :title="`Supprimer le groupe « ${g.name} » ?`"
              description="Ses catégories sont conservées, sans groupe."
              @confirm="removeGroup(g)"
            >
              <button
                type="button"
                class="rounded-full p-0.5 hover:bg-black/10"
                :aria-label="`Supprimer ${g.name}`"
              >
                <X class="size-3" />
              </button>
            </ConfirmDialog>
          </Badge>
        </div>
        <form class="flex flex-wrap gap-2" @submit.prevent="createGroup">
          <Input v-model="groupName" placeholder="Nouveau groupe" required class="w-56" />
          <Button type="submit" variant="outline">Ajouter le groupe</Button>
        </form>
      </div>

      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <h3 class="mr-auto text-sm font-medium">Catégories</h3>
          <template v-if="groups.length > 0">
            <Switch id="categories-by-group" v-model="byGroup" />
            <Label for="categories-by-group" class="font-normal">Regrouper par groupe</Label>
          </template>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Groupe</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-for="section in sections" :key="section.key">
              <TableRow v-if="section.title" class="bg-muted/50 hover:bg-muted/50">
                <TableCell colspan="4" class="font-medium">
                  {{ section.title }}
                  <span class="font-normal text-muted-foreground">· {{ section.items.length }}</span>
                </TableCell>
              </TableRow>
              <TableRow v-if="section.title && section.items.length === 0">
                <TableCell colspan="4" class="text-muted-foreground">Aucune catégorie dans ce groupe</TableCell>
              </TableRow>
              <TableRow v-for="c in section.items" :key="c._id">
                <TableCell class="font-medium">{{ c.name }}</TableCell>
                <TableCell>
                  <Badge :variant="c.kind === 'income' ? 'default' : 'secondary'">
                    {{ CATEGORY_KINDS[c.kind] }}
                  </Badge>
                </TableCell>
                <TableCell>
                  <OptionSelect
                    :model-value="c.group ?? NO_GROUP"
                    :options="groupOptions"
                    class="w-44"
                    @update:model-value="setGroup(c, $event)"
                  />
                </TableCell>
                <TableCell class="text-right">
                  <ConfirmDialog
                    :title="`Supprimer la catégorie « ${c.name} » ?`"
                    description="Les transactions de cette catégorie deviendront sans catégorie."
                    @confirm="removeCategory(c)"
                  >
                    <Button size="icon-sm" variant="ghost" :aria-label="`Supprimer ${c.name}`">
                      <Trash2 />
                    </Button>
                  </ConfirmDialog>
                </TableCell>
              </TableRow>
            </template>
            <TableEmpty v-if="categories.length === 0" :colspan="4">Aucune catégorie</TableEmpty>
          </TableBody>
        </Table>
        <form class="flex flex-wrap gap-2" @submit.prevent="createCategory">
          <Input v-model="name" placeholder="Nouvelle catégorie" required class="w-56" />
          <OptionSelect v-model="kind" :options="CATEGORY_KINDS" class="w-32" />
          <OptionSelect v-model="group" :options="groupOptions" class="w-44" />
          <Button type="submit">Ajouter</Button>
        </form>
      </div>
    </CardContent>
  </Card>
</template>
