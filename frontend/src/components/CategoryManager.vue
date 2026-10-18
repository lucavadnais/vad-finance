<script setup lang="ts">
// "Catégories et groupes" section of the settings: one kind at a time (Dépenses /
// Revenus), a tile adding a group, then a tile per group, its color as a dot,
// "Sans groupe" last. A tile's "…" edits or deletes the group (in a sheet on a
// phone, ActionSheet); tapping the tile opens the group: its categories, and
// the button adding one into it. "Regrouper" off: every category in one list,
// its group beside it.
// Also the setup wizard's categories step (`wizard`): the same, without the
// header (the wizard has its own) or archiving.
import type { Category, CategoryGroup, CategoryKind } from '@/types';
import type { SheetAction } from './ActionSheet.vue';
import { computed, ref, useId, watch } from 'vue';
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  Ellipsis,
  FolderPlus,
  Pencil,
  Plus,
  SearchX,
  Tags,
  Trash2,
} from '@lucide/vue';
import { api } from '@/api';
import { normalizeText } from '@/lib/text';
import { useFinanceData } from '@/composables/useFinanceData';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ActionSheet from './ActionSheet.vue';
import CategoryDialog from './CategoryDialog.vue';
import CategoryDot from './CategoryDot.vue';
import ConfirmDialog from './ConfirmDialog.vue';
import EmptyState from './EmptyState.vue';
import GroupDialog from './GroupDialog.vue';
import SearchInput from './SearchInput.vue';

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
const kind = defineModel<CategoryKind>('kind', { default: 'expense' });
const shownCategories = computed(() => props.categories.filter((c) => c.kind === kind.value));
const countOf = (k: CategoryKind) => props.categories.filter((c) => c.kind === k).length;

const sorted = computed(() => [...shownCategories.value].sort((a, b) => a.name.localeCompare(b.name, 'fr')));

// By group (tiles), or every category in one list (the wizard starts there)
const grouped = ref(!props.wizard);
const groupedId = useId();

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

// Searched by the group's name or a category's (accents and case ignored): a
// group found by its name keeps all its categories, else only those found
const search = ref('');
const query = computed(() => normalizeText(search.value));
const found = computed<Section[]>(() => {
  const q = query.value;
  if (!q) return sections.value;
  return sections.value.flatMap((section) => {
    if (normalizeText(section.title).includes(q)) return [section];
    const items = section.items.filter((c) => normalizeText(c.name).includes(q));
    return items.length > 0 ? [{ ...section, items }] : [];
  });
});
// A group's count: all its categories, even while searching
const countIn = (section: Section) => sections.value.find((s) => s.key === section.key)?.items.length ?? 0;

// Not grouped: every category, found by its name or its group's
const groupName = (c: Category) => (c.group ? groupOptions.value[c.group] : undefined);
const flat = computed(() =>
  activeFirst(
    sorted.value.filter(
      (c) => normalizeText(c.name).includes(query.value) || normalizeText(groupName(c) ?? '').includes(query.value),
    ),
  ),
);

// The group opened from its tile (its section's key); back to the tiles once
// it is gone (deleted, the other kind shown, or no longer found)
const openKey = ref<string | null>(null);
const opened = computed(() => found.value.find((s) => s.key === openKey.value) ?? null);
watch([kind, grouped], () => (openKey.value = null));

watch(opened, (section) => {
  if (!section) openKey.value = null;
});
const listed = computed(() => opened.value?.items ?? flat.value);
// Said in their place when there are none; not searching, it then offers
// the first one itself, in place of the "Catégorie" button
const addInEmpty = computed(() => listed.value.length === 0 && !query.value);
// The "Catégorie" button: not while searching either
const showAdd = computed(() => !query.value && !addInEmpty.value);
const emptyListed = computed(() =>
  query.value
    ? { icon: SearchX, title: 'Aucune catégorie trouvée', description: 'Essayez avec un autre nom.' }
    : {
        icon: Tags,
        title: opened.value ? 'Aucune catégorie dans ce groupe' : 'Aucune catégorie',
        actionLabel: 'Ajouter une catégorie',
      },
);
const addCategory = () => openCategory(null, opened.value?.group?._id ?? null);

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
    description: `${countIn(section)} catégorie${countIn(section) > 1 ? 's' : ''}`,
    color: group?.color,
    actions: [
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
      <div class="ml-auto flex items-center gap-2">
        <Switch :id="groupedId" v-model="grouped" />
        <Label :for="groupedId" class="font-normal">Regrouper</Label>
      </div>
    </div>

    <!-- The search: by a group's name or a category's -->
    <SearchInput v-model="search" placeholder="Groupe ou catégorie…" label="Rechercher un groupe ou une catégorie" />

    <!-- The groups, a tile each; only they scroll -->
    <div v-if="grouped && !opened" class="-m-1 flex min-h-0 flex-1 flex-col overflow-y-auto p-1">
      <!-- No group yet: the empty list offers the first one, in place of the
           "Nouveau groupe" tile -->
      <EmptyState
        v-if="!query && found.length === 0"
        :icon="FolderPlus"
        title="Aucun groupe"
        description="Les groupes rassemblent vos catégories, pour mieux les analyser."
        action-label="Ajouter un groupe"
        @action="openGroup(null)"
      />
      <div v-else-if="found.length > 0" class="grid gap-3 sm:grid-cols-3">
        <!-- Adding a group, a tile of its own; not while searching -->
        <button
          v-if="!query"
          type="button"
          class="flex h-32 min-w-0 flex-col items-center justify-center gap-2 rounded-3xl max-sm:h-14 max-sm:flex-row border-2 border-dashed border-primary/40 bg-primary/5 p-4 font-medium text-primary transition outline-none hover:bg-primary/10 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98]"
          @click="openGroup(null)"
        >
          <FolderPlus class="size-6" />
          Nouveau groupe
        </button>
        <!-- The tile opens the group; its "…" (top right) edits or deletes it -->
        <div
          v-for="section in found"
          :key="section.key"
          class="relative h-32 min-w-0 rounded-3xl bg-card shadow-sm transition hover:bg-muted/50 active:scale-[0.98] max-sm:h-24"
          :class="section.group ? 'border' : 'border-2 border-dashed border-muted-foreground/40'"
        >
          <button
            type="button"
            class="flex size-full flex-col rounded-[inherit] p-4 text-left max-sm:p-3.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            :aria-label="`Ouvrir ${section.title}`"
            @click="openKey = section.key"
          >
            <!-- Its color, the name (on two lines if need be), its count under it -->
            <span class="flex items-start gap-2" :class="section.group && 'pr-7'">
              <CategoryDot :color="section.group?.color" class="mt-1 size-3" />
              <span
                class="line-clamp-2 text-base leading-tight font-medium break-words max-sm:line-clamp-1"
                :title="section.title"
              >
                {{ section.title }}
              </span>
            </span>
            <span class="pl-5 text-xs text-muted-foreground tabular-nums">
              {{ countIn(section) }} catégorie{{ countIn(section) > 1 ? 's' : '' }}
            </span>
            <!-- Its categories (those found, while searching), each with its
                 color, as many as fit on a line -->
            <span class="mt-auto flex h-4 flex-wrap gap-x-3 overflow-hidden text-xs text-muted-foreground">
              <span v-for="c in section.items" :key="c._id" class="inline-flex items-center gap-1.5">
                <CategoryDot :color="categoryColors.get(c._id)" class="size-2" />
                {{ c.name }}
              </span>
              <template v-if="section.items.length === 0">Aucune catégorie</template>
            </span>
          </button>
          <template v-if="section.group">
            <!-- Phone: the actions in a sheet -->
            <Button
              size="icon-sm"
              variant="ghost"
              class="absolute top-2.5 right-2.5 max-sm:top-2 max-sm:right-2 sm:hidden"
              :aria-label="`Actions du groupe ${section.title}`"
              @click="sectionActions(section)"
            >
              <Ellipsis />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  class="absolute top-2.5 right-2.5 max-sm:top-2 max-sm:right-2 max-sm:hidden"
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
          </template>
        </div>
      </div>
      <!-- Nothing found -->
      <EmptyState
        v-if="query && found.length === 0"
        :icon="SearchX"
        title="Aucun groupe ni catégorie trouvé"
        description="Essayez avec un autre nom."
      />
    </div>

    <!-- A group opened: its categories, under its name and actions. Not
         grouped: every category, under the button adding one -->
    <div v-else class="flex min-h-0 flex-1 flex-col gap-2">
      <div v-if="opened || showAdd" class="flex items-center gap-1">
        <template v-if="opened">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Retour aux groupes"
            title="Retour aux groupes"
            @click="openKey = null"
          >
            <ChevronLeft />
          </Button>
          <CategoryDot v-if="opened.group" :color="opened.group.color" class="mx-1.5 size-3" />
          <h3 class="min-w-0 truncate font-semibold">{{ opened.title }}</h3>
          <span class="shrink-0 text-muted-foreground">· {{ countIn(opened) }}</span>
        </template>
        <!-- Adding a category (into the group); the group's own actions are on its tile -->
        <Button
          v-if="showAdd"
          size="sm"
          class="ml-auto shrink-0"
          :aria-label="opened ? `Ajouter une catégorie à ${opened.title}` : 'Ajouter une catégorie'"
          @click="addCategory"
        >
          <Plus />
          Catégorie
        </Button>
      </div>

      <EmptyState v-if="listed.length === 0" v-bind="emptyListed" @action="addCategory" />
      <!-- Only the list scrolls -->
      <div
        v-else
        class="flex min-h-0 flex-1 flex-col *:data-[slot=table-container]:min-h-0 *:data-[slot=table-container]:flex-1"
      >
        <Table>
          <TableBody>
            <TableRow v-for="c in listed" :key="c._id" :class="c.archived && 'text-muted-foreground'">
              <TableCell class="font-medium">
                <span class="flex items-center gap-2">
                  <CategoryDot :color="categoryColors.get(c._id)" />
                  {{ c.name }}
                  <!-- Not grouped: its group beside it -->
                  <span v-if="!opened && groupName(c)" class="text-xs font-normal text-muted-foreground">
                    · {{ groupName(c) }}
                  </span>
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
          </TableBody>
        </Table>
      </div>
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
