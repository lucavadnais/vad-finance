<script setup lang="ts">
// "Catégories et groupes" section of the settings: one kind at a time (Dépenses /
// Revenus), a split button to add a group or a category, then the categories,
// by group. Each group's row shows its color, a "+" adding a category straight
// into it, and a menu to edit or delete it. On a phone, a "…" instead of the
// actions, opening them in a sheet (ActionSheet).
// Also the setup wizard's categories step (`wizard`): the same, without the
// header (the wizard has its own) or archiving.
import type { Category, CategoryGroup, CategoryKind } from '@/types';
import type { SheetAction } from './ActionSheet.vue';
import { computed, ref } from 'vue';
import { Archive, ArchiveRestore, ChevronDown, Ellipsis, FolderPlus, Pencil, Plus, Trash2 } from '@lucide/vue';
import { api } from '@/api';
import { useFinanceData } from '@/composables/useFinanceData';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ActionSheet from './ActionSheet.vue';
import CategoryDialog from './CategoryDialog.vue';
import CategoryDot from './CategoryDot.vue';
import ConfirmDialog from './ConfirmDialog.vue';
import GroupDialog from './GroupDialog.vue';

const props = defineProps<{ categories: Category[]; groups: CategoryGroup[]; wizard?: boolean }>();
const emit = defineEmits<{ changed: []; error: [message: string] }>();

const { categoryColors } = useFinanceData();

// "No group" uses a sentinel key
const NO_GROUP = 'none';
const groupOptions = computed<Record<string, string>>(() => ({
  [NO_GROUP]: 'Aucun groupe',
  ...Object.fromEntries(props.groups.map((g) => [g._id, g.name])),
}));

// The kind shown, picked above the table
const kind = ref<CategoryKind>('expense');
const shownCategories = computed(() => props.categories.filter((c) => c.kind === kind.value));
const countOf = (k: CategoryKind) => props.categories.filter((c) => c.kind === k).length;
// Name, actions: no "Type" (the tabs give it) nor "Groupe" (the sections
// give it; it changes in the category's dialog)
const columns = 2;

const sorted = computed(() => [...shownCategories.value].sort((a, b) => a.name.localeCompare(b.name, 'fr')));

// A section per group (then "Sans groupe"). Archived categories stay in place,
// after the active ones of their section.
const activeFirst = (items: Category[]) => [...items].sort((a, b) => Number(a.archived) - Number(b.archived));
interface Section {
  key: string;
  title: string;
  // The group behind the section; null for "Sans groupe"
  group: CategoryGroup | null;
  items: Category[];
}
const sections = computed<Section[]>(() => {
  const groups = [...props.groups].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return [
    ...groups
      // A group whose categories are all of the other kind shows there
      .filter((g) => !props.categories.some((c) => c.group === g._id) || sorted.value.some((c) => c.group === g._id))
      .map((g) => ({
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

// Category deleted after confirming
const deletingCategory = ref<Category | null>(null);
const confirmDeleteCategory = ref(false);
function askDeleteCategory(category: Category) {
  deletingCategory.value = category;
  confirmDeleteCategory.value = true;
}

// Phone: the actions of a category or a section, in a sheet
const sheet = ref({
  open: false,
  title: '',
  description: '',
  color: undefined as string | undefined,
  actions: [] as SheetAction[],
});
function categoryActions(c: Category) {
  const actions: SheetAction[] = c.archived
    ? [{ label: 'Désarchiver', icon: ArchiveRestore, run: () => setArchived(c, false) }]
    : [
        { label: 'Modifier', icon: Pencil, run: () => openCategory(c) },
        ...(props.wizard ? [] : [{ label: 'Archiver', icon: Archive, run: () => setArchived(c, true) }]),
        { label: 'Supprimer', icon: Trash2, destructive: true, run: () => askDeleteCategory(c) },
      ];
  sheet.value = {
    open: true,
    title: c.name,
    description: [groupOptions.value[c.group ?? NO_GROUP], c.archived && 'Archivée'].filter(Boolean).join(' · '),
    color: categoryColors.value.get(c._id),
    actions,
  };
}
function sectionActions(section: Section) {
  const group = section.group;
  sheet.value = {
    open: true,
    title: section.title,
    description: `${section.items.length} catégorie${section.items.length > 1 ? 's' : ''}`,
    color: group?.color,
    actions: [
      { label: 'Ajouter une catégorie', icon: Plus, run: () => openCategory(null, group?._id ?? null) },
      ...(group
        ? [
            { label: 'Modifier le groupe', icon: Pencil, run: () => openGroup(group) },
            { label: 'Supprimer le groupe', icon: Trash2, destructive: true, run: () => askDeleteGroup(group) },
          ]
        : []),
    ],
  };
}

async function run(action: () => Promise<unknown>) {
  try {
    await action();
    emit('changed');
  } catch (err) {
    emit('error', (err as Error).message);
  }
}

const removeCategory = () => {
  const category = deletingCategory.value;
  if (category) run(() => api.deleteCategory(category._id));
};

// Archived: kept on its transactions, no longer offered when picking a category
const setArchived = (category: Category, archived: boolean) =>
  run(() => api.updateCategory(category._id, { archived }));

const removeGroup = () => {
  const group = deleting.value;
  if (group) run(() => api.deleteCategoryGroup(group._id));
};
</script>

<template>
  <!-- A section of the settings dialog (or the wizard's step) -->
  <section class="flex min-h-0 flex-1 flex-col" :class="wizard ? 'gap-4' : 'gap-6'">
    <header v-if="!wizard" class="flex flex-col gap-1 pr-6">
      <h2 class="text-lg font-semibold">Catégories et groupes</h2>
      <p class="text-sm text-muted-foreground">
        Classer les transactions selon s'ils sont des revenus ou des dépenses. Regrouper les catégories dans des groupes
        permet une meilleure analyse.
      </p>
    </header>

    <div class="flex flex-wrap items-center gap-2">
      <Tabs v-model="kind">
        <TabsList>
          <TabsTrigger value="expense">Dépenses · {{ countOf('expense') }}</TabsTrigger>
          <TabsTrigger value="income">Revenus · {{ countOf('income') }}</TabsTrigger>
        </TabsList>
      </Tabs>
      <!-- Split button: adds a group, its arrow offers a category -->
      <div class="ml-auto flex">
        <Button class="rounded-r-none" @click="openGroup(null)">
          <FolderPlus />
          Groupe
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              size="icon"
              class="rounded-l-none border-l border-primary-foreground/25"
              aria-label="Autres ajouts"
              title="Autres ajouts"
            >
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @select="openGroup(null)">
              <FolderPlus />
              Nouveau groupe
            </DropdownMenuItem>
            <DropdownMenuItem @select="openCategory(null)">
              <Plus />
              Nouvelle catégorie
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

    <!-- Only the list scrolls, under a sticky header -->
    <div
      class="flex min-h-0 flex-1 flex-col *:data-[slot=table-container]:min-h-0 *:data-[slot=table-container]:flex-1"
    >
      <Table>
        <TableHeader class="sticky top-0 z-10 bg-background">
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-for="section in sections" :key="section.key">
            <!-- The group's row: its color, a "+" adding a category into it, its menu (edit, delete) -->
            <TableRow class="bg-muted/50 hover:bg-muted/50">
              <TableCell :colspan="columns" class="py-1.5">
                <div class="flex items-center gap-1">
                  <CategoryDot v-if="section.group" :color="section.group.color" class="mx-2.5 size-3" />
                  <span class="font-medium" :class="!section.group && 'pl-2'">{{ section.title }}</span>
                  <span class="text-muted-foreground">· {{ section.items.length }}</span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    class="ml-auto sm:hidden"
                    :aria-label="`Actions de ${section.title}`"
                    @click="sectionActions(section)"
                  >
                    <Ellipsis />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    class="ml-auto text-muted-foreground max-sm:hidden"
                    :aria-label="`Ajouter une catégorie à ${section.title}`"
                    @click="openCategory(null, section.group?._id ?? null)"
                  >
                    <Plus />
                    Catégorie
                  </Button>
                  <DropdownMenu v-if="section.group">
                    <DropdownMenuTrigger as-child>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        class="max-sm:hidden"
                        :aria-label="`Actions du groupe ${section.title}`"
                      >
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
            <TableRow v-if="section.items.length === 0">
              <TableCell :colspan="columns" class="text-muted-foreground">Aucune catégorie dans ce groupe</TableCell>
            </TableRow>
            <TableRow v-for="c in section.items" :key="c._id" :class="c.archived && 'text-muted-foreground'">
              <TableCell class="font-medium">
                <span class="flex items-center gap-2">
                  <CategoryDot :color="categoryColors.get(c._id)" />
                  {{ c.name }}
                  <Badge v-if="c.archived" variant="outline" class="font-normal text-muted-foreground">Archivée</Badge>
                </span>
              </TableCell>
              <TableCell class="text-right whitespace-nowrap">
                <!-- Phone: the actions in a sheet -->
                <Button
                  size="icon-sm"
                  variant="ghost"
                  class="sm:hidden"
                  :aria-label="`Actions de ${c.name}`"
                  @click="categoryActions(c)"
                >
                  <Ellipsis />
                </Button>
                <!-- Archived: it can only be unarchived -->
                <Button
                  v-if="c.archived"
                  class="max-sm:hidden"
                  size="sm"
                  variant="ghost"
                  :aria-label="`Désarchiver ${c.name}`"
                  @click="setArchived(c, false)"
                >
                  <ArchiveRestore />
                  Désarchiver
                </Button>
                <span v-else class="max-sm:hidden">
                  <Button size="icon-sm" variant="ghost" :aria-label="`Modifier ${c.name}`" @click="openCategory(c)">
                    <Pencil />
                  </Button>
                  <Button
                    v-if="!wizard"
                    size="icon-sm"
                    variant="ghost"
                    :aria-label="`Archiver ${c.name}`"
                    title="Archiver : garder ses transactions, ne plus la proposer"
                    @click="setArchived(c, true)"
                  >
                    <Archive />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    :aria-label="`Supprimer ${c.name}`"
                    @click="askDeleteCategory(c)"
                  >
                    <Trash2 />
                  </Button>
                </span>
              </TableCell>
            </TableRow>
          </template>
          <TableEmpty v-if="sections.length === 0" :colspan="columns"> Aucune catégorie </TableEmpty>
        </TableBody>
      </Table>
    </div>

    <CategoryDialog
      v-model:open="categoryDialog.open"
      :category="categoryDialog.category"
      :default-group="categoryDialog.defaultGroup"
      :default-kind="kind"
      :groups="groups"
      @saved="emit('changed')"
    />
    <GroupDialog v-model:open="groupDialog.open" :group="groupDialog.group" @saved="emit('changed')" />
    <ActionSheet
      v-model:open="sheet.open"
      :title="sheet.title"
      :description="sheet.description"
      :actions="sheet.actions"
    >
      <template v-if="sheet.color" #icon>
        <CategoryDot :color="sheet.color" class="size-4" />
      </template>
    </ActionSheet>
    <ConfirmDialog
      v-model:open="confirmDeleteCategory"
      :title="`Supprimer la catégorie « ${deletingCategory?.name} » ?`"
      :description="
        wizard
          ? undefined
          : 'Ses transactions deviendront sans catégorie. Pour garder l\'historique, archivez-la plutôt.'
      "
      @confirm="removeCategory"
    />
    <ConfirmDialog
      v-model:open="confirmDelete"
      :title="`Supprimer le groupe « ${deleting?.name} » ?`"
      description="Ses catégories sont conservées, sans groupe."
      @confirm="removeGroup"
    />
  </section>
</template>
