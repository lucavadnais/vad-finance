<script setup lang="ts">
import type { Category, CategoryGroup, CategoryKind } from '@/types';
import { computed, ref, watch } from 'vue';
import { Plus, Trash2 } from '@lucide/vue';
import { api } from '@/api';
import { CATEGORY_KINDS } from '@/lib/labels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectItem, SelectSeparator } from '@/components/ui/select';
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
import GroupCreateDialog from './GroupCreateDialog.vue';
import GroupManagerDialog from './GroupManagerDialog.vue';
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

// Last item of the new category's group select, below a separator: opens the group dialog
const NEW_GROUP = 'new';
const creatingGroup = ref(false);
// The select keeps its value while the dialog is open: "new" is never selected
const groupSelect = computed({
  get: () => group.value,
  set: (value: string) => {
    if (value === NEW_GROUP) creatingGroup.value = true;
    else group.value = value;
  },
});
function onGroupCreated(created: CategoryGroup) {
  group.value = created._id;
  emit('changed');
}

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

// A deleted group can no longer be chosen for the next category
watch(
  () => props.groups,
  (groups) => {
    if (group.value !== NO_GROUP && !groups.some((g) => g._id === group.value)) group.value = NO_GROUP;
  },
);
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
        <div class="flex items-center gap-2">
          <h3 class="mr-auto text-sm font-medium">Catégories</h3>
          <template v-if="groups.length > 0">
            <Switch id="categories-by-group" v-model="byGroup" />
            <Label for="categories-by-group" class="font-normal">Regrouper par groupe</Label>
          </template>
        </div>
        <form class="flex flex-wrap items-end gap-2" @submit.prevent="createCategory">
          <div class="flex flex-col gap-2">
            <Label for="category-name">Nom</Label>
            <Input id="category-name" v-model="name" placeholder="Nouvelle catégorie" required class="w-56" />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="category-kind">Type</Label>
            <OptionSelect id="category-kind" v-model="kind" :options="CATEGORY_KINDS" class="w-32" />
          </div>
          <div class="flex flex-col gap-2">
            <div class="flex items-baseline justify-between gap-2">
              <Label for="category-group">Groupe</Label>
              <GroupManagerDialog :groups="groups" :categories="categories" @changed="emit('changed')" />
            </div>
            <OptionSelect id="category-group" v-model="groupSelect" :options="groupOptions" class="w-52">
              <template #after>
                <SelectSeparator />
                <SelectItem :value="NEW_GROUP">
                  <Plus />
                  Nouveau groupe…
                </SelectItem>
              </template>
            </OptionSelect>
          </div>
          <Button type="submit">Ajouter</Button>
        </form>
        <GroupCreateDialog v-model:open="creatingGroup" @created="onGroupCreated" />
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
      </div>
    </CardContent>
  </Card>
</template>
