<script setup lang="ts">
// "Catégories et groupes" section of the settings: a toolbar to add a category
// or a group, then the categories, by group. Each group's row shows its color,
// a "+" adding a category straight into it, and a menu to edit or delete it.
import type { Category, CategoryGroup } from '@/types';
import { computed, ref } from 'vue';
import { Archive, ArchiveRestore, Ellipsis, Pencil, Plus, Trash2 } from '@lucide/vue';
import { api } from '@/api';
import { useFinanceData } from '@/composables/useFinanceData';
import { CATEGORY_KINDS } from '@/lib/labels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import CategoryDialog from './CategoryDialog.vue';
import CategoryDot from './CategoryDot.vue';
import ConfirmDialog from './ConfirmDialog.vue';
import GroupDialog from './GroupDialog.vue';
import OptionSelect from './OptionSelect.vue';

const props = defineProps<{ categories: Category[]; groups: CategoryGroup[] }>();
const emit = defineEmits<{ changed: []; error: [message: string] }>();

const { categoryColors } = useFinanceData();

// Select items cannot have an empty value, so "no group" uses a sentinel
const NO_GROUP = 'none';
const groupOptions = computed<Record<string, string>>(() => ({
  [NO_GROUP]: 'Aucun groupe',
  ...Object.fromEntries(props.groups.map((g) => [g._id, g.name])),
}));

const sorted = computed(() =>
  [...props.categories].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, 'fr')),
);

// Table display: one flat list, or a section per group (then "Sans groupe").
// Archived categories stay in place, after the active ones of their section.
const byGroup = ref(true);
const activeFirst = (items: Category[]) => [...items].sort((a, b) => Number(a.archived) - Number(b.archived));
interface Section {
  key: string;
  title: string | null;
  // The group behind the section; null for "Sans groupe" and the flat list
  group: CategoryGroup | null;
  items: Category[];
}
const sections = computed<Section[]>(() => {
  if (!byGroup.value || props.groups.length === 0) {
    return [{ key: 'all', title: null, group: null, items: activeFirst(sorted.value) }];
  }
  const groups = [...props.groups].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return [
    ...groups.map((g) => ({
      key: g._id,
      title: g.name,
      group: g,
      items: activeFirst(sorted.value.filter((c) => c.group === g._id)),
    })),
    { key: NO_GROUP, title: 'Sans groupe', group: null, items: activeFirst(sorted.value.filter((c) => !c.group)) },
  ].filter((section) => section.items.length > 0 || section.key !== NO_GROUP);
});

// Category dialog: a new category (in `defaultGroup`), or `category` edited
const categoryDialog = ref({ open: false, category: null as Category | null, defaultGroup: null as string | null });
const openCategory = (category: Category | null, defaultGroup: string | null = null) =>
  (categoryDialog.value = { open: true, category, defaultGroup });

// Group dialog: a new group, or `group` edited
const groupDialog = ref({ open: false, group: null as CategoryGroup | null });
const openGroup = (group: CategoryGroup | null) => (groupDialog.value = { open: true, group });

// Group deleted after confirming (its categories stay, without a group)
const deleting = ref<CategoryGroup | null>(null);
const confirmDelete = ref(false);
function askDeleteGroup(group: CategoryGroup) {
  deleting.value = group;
  confirmDelete.value = true;
}

async function run(action: () => Promise<unknown>) {
  try {
    await action();
    emit('changed');
  } catch (err) {
    emit('error', (err as Error).message);
  }
}

const setGroup = (category: Category, value: string | undefined) =>
  run(() => api.updateCategory(category._id, { group: !value || value === NO_GROUP ? null : value }));

const removeCategory = (category: Category) => run(() => api.deleteCategory(category._id));

// Archived: kept on its transactions, no longer offered when picking a category
const setArchived = (category: Category, archived: boolean) =>
  run(() => api.updateCategory(category._id, { archived }));

const removeGroup = () => {
  const group = deleting.value;
  if (group) run(() => api.deleteCategoryGroup(group._id));
};
</script>

<template>
  <!-- A section of the settings dialog -->
  <section class="flex min-h-0 flex-1 flex-col gap-6">
    <header class="flex flex-col gap-1 pr-6">
      <h2 class="text-lg font-semibold">Catégories et groupes</h2>
      <p class="text-sm text-muted-foreground">
        Pour classer les transactions en revenus et en dépenses. Les groupes rassemblent plusieurs catégories (ex.
        Électricité et Internet dans « Milieu de vie ») pour l'analyse, dans des nuances de leur couleur.
      </p>
    </header>

    <div class="flex flex-wrap items-center gap-2">
      <template v-if="groups.length > 0">
        <Switch id="categories-by-group" v-model="byGroup" />
        <Label for="categories-by-group" class="font-normal">Regrouper par groupe</Label>
      </template>
      <Button variant="outline" class="ml-auto" @click="openGroup(null)">
        <Plus />
        Groupe
      </Button>
      <Button @click="openCategory(null)">
        <Plus />
        Catégorie
      </Button>
    </div>

    <!-- Only the list scrolls, under a sticky header -->
    <div
      class="flex min-h-0 flex-1 flex-col *:data-[slot=table-container]:min-h-0 *:data-[slot=table-container]:flex-1"
    >
      <Table>
        <TableHeader class="sticky top-0 z-10 bg-background">
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Groupe</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-for="section in sections" :key="section.key">
            <!-- The group's row: its color, a "+" adding a category into it, its menu (edit, delete) -->
            <TableRow v-if="section.title" class="bg-muted/50 hover:bg-muted/50">
              <TableCell colspan="4" class="py-1.5">
                <div class="flex items-center gap-1">
                  <CategoryDot v-if="section.group" :color="section.group.color" class="mx-2.5 size-3" />
                  <span class="font-medium" :class="!section.group && 'pl-2'">{{ section.title }}</span>
                  <span class="text-muted-foreground">· {{ section.items.length }}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    class="ml-auto text-muted-foreground"
                    :aria-label="`Ajouter une catégorie à ${section.title}`"
                    @click="openCategory(null, section.group?._id ?? null)"
                  >
                    <Plus />
                    Catégorie
                  </Button>
                  <DropdownMenu v-if="section.group">
                    <DropdownMenuTrigger as-child>
                      <Button size="icon-sm" variant="ghost" :aria-label="`Actions du groupe ${section.title}`">
                        <Ellipsis />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem @select="openGroup(section.group)">
                        <Pencil />
                        Modifier le groupe
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" @select="askDeleteGroup(section.group)">
                        <Trash2 />
                        Supprimer le groupe
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-if="section.title && section.items.length === 0">
              <TableCell colspan="4" class="text-muted-foreground">Aucune catégorie dans ce groupe</TableCell>
            </TableRow>
            <TableRow v-for="c in section.items" :key="c._id" :class="c.archived && 'text-muted-foreground'">
              <TableCell class="font-medium">
                <span class="flex items-center gap-2">
                  <CategoryDot :color="categoryColors.get(c._id)" />
                  {{ c.name }}
                  <Badge v-if="c.archived" variant="outline" class="font-normal text-muted-foreground">Archivée</Badge>
                </span>
              </TableCell>
              <TableCell>
                <Badge :variant="c.kind === 'income' ? 'default' : 'secondary'">
                  {{ CATEGORY_KINDS[c.kind] }}
                </Badge>
              </TableCell>
              <TableCell>
                <!-- Nothing changes on an archived category -->
                <span v-if="c.archived" class="px-3 text-sm">{{ groupOptions[c.group ?? NO_GROUP] }}</span>
                <OptionSelect
                  v-else
                  :model-value="c.group ?? NO_GROUP"
                  :options="groupOptions"
                  class="w-44"
                  @update:model-value="setGroup(c, $event)"
                />
              </TableCell>
              <TableCell class="text-right whitespace-nowrap">
                <!-- Archived: it can only be unarchived -->
                <Button
                  v-if="c.archived"
                  size="sm"
                  variant="ghost"
                  :aria-label="`Désarchiver ${c.name}`"
                  @click="setArchived(c, false)"
                >
                  <ArchiveRestore />
                  Désarchiver
                </Button>
                <template v-else>
                  <Button size="icon-sm" variant="ghost" :aria-label="`Modifier ${c.name}`" @click="openCategory(c)">
                    <Pencil />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    :aria-label="`Archiver ${c.name}`"
                    title="Archiver : garder ses transactions, ne plus la proposer"
                    @click="setArchived(c, true)"
                  >
                    <Archive />
                  </Button>
                  <ConfirmDialog
                    :title="`Supprimer la catégorie « ${c.name} » ?`"
                    description="Ses transactions deviendront sans catégorie. Pour garder l'historique, archivez-la plutôt."
                    @confirm="removeCategory(c)"
                  >
                    <Button size="icon-sm" variant="ghost" :aria-label="`Supprimer ${c.name}`">
                      <Trash2 />
                    </Button>
                  </ConfirmDialog>
                </template>
              </TableCell>
            </TableRow>
          </template>
          <TableEmpty v-if="categories.length === 0" :colspan="4">Aucune catégorie</TableEmpty>
        </TableBody>
      </Table>
    </div>

    <CategoryDialog
      v-model:open="categoryDialog.open"
      :category="categoryDialog.category"
      :default-group="categoryDialog.defaultGroup"
      :groups="groups"
      @saved="emit('changed')"
    />
    <GroupDialog v-model:open="groupDialog.open" :group="groupDialog.group" @saved="emit('changed')" />
    <ConfirmDialog
      v-model:open="confirmDelete"
      :title="`Supprimer le groupe « ${deleting?.name} » ?`"
      description="Ses catégories sont conservées, sans groupe."
      @confirm="removeGroup"
    />
  </section>
</template>
