<script setup lang="ts">
// Creates a category (in `defaultGroup` if given), or edits `category`: name,
// kind, group and color - a shade of the group's when in one. Opened through
// v-model:open.
import type { Category, CategoryGroup, CategoryKind } from '@/types';
import { computed, ref, watch } from 'vue';
import { Plus } from '@lucide/vue';
import { api } from '@/api';
import { shadeScale } from '@/lib/colors';
import { CATEGORY_KINDS } from '@/lib/labels';
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
import { SelectItem, SelectSeparator } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CategoryColorPicker from './CategoryColorPicker.vue';
import GroupDialog from './GroupDialog.vue';
import OptionSelect from './OptionSelect.vue';

const open = defineModel<boolean>('open', { required: true });
const props = defineProps<{
  category?: Category | null;
  groups: CategoryGroup[];
  // New category: the group it starts in (e.g. "+" on a group's row)
  defaultGroup?: string | null;
}>();
const emit = defineEmits<{ saved: [] }>();

const editing = computed(() => !!props.category);

// Select items cannot have an empty value, so "no group" uses a sentinel, and
// the last item, "Nouveau groupe…", opens the group dialog
const NO_GROUP = 'none';
const NEW_GROUP = 'new';
const groupOptions = computed<Record<string, string>>(() => ({
  [NO_GROUP]: 'Aucun groupe',
  ...Object.fromEntries(props.groups.map((g) => [g._id, g.name])),
}));

const name = ref('');
const kind = ref<CategoryKind>('expense');
const group = ref(NO_GROUP);
// Without a group; null: the backend draws one
const color = ref<string | null>(null);
// In a group: the shade picked (index in the group's scale), null = automatic
const shade = ref<number | null>(null);
const saving = ref(false);
const error = ref('');

// Every opening starts from the category, or an empty form
watch(open, (value) => {
  if (!value) return;
  const c = props.category;
  name.value = c?.name ?? '';
  kind.value = c?.kind ?? 'expense';
  group.value = c?.group ?? props.defaultGroup ?? NO_GROUP;
  color.value = c?.color ?? null;
  shade.value = c?.shade ?? null;
  error.value = '';
});

// The select keeps its value while the group dialog is open
const creatingGroup = ref(false);
const groupSelect = computed({
  get: () => group.value,
  set: (value: string) => {
    if (value === NEW_GROUP) creatingGroup.value = true;
    else group.value = value;
  },
});
function onGroupCreated(created: CategoryGroup) {
  group.value = created._id;
  emit('saved');
}

const selectedGroup = computed(() => props.groups.find((g) => g._id === group.value));
// The picker works with colors: map the shade index to its color and back
const scale = computed(() => (selectedGroup.value ? shadeScale(selectedGroup.value.color) : []));
const shadeColor = computed({
  get: () => (shade.value === null ? null : (scale.value[shade.value] ?? null)),
  set: (hex: string | null) => {
    const i = hex ? scale.value.indexOf(hex) : -1;
    shade.value = i >= 0 ? i : null;
  },
});

const kindChanged = computed(() => !!props.category && kind.value !== props.category.kind);

function onOpenChange(value: boolean) {
  if (!saving.value) open.value = value;
}

async function save() {
  saving.value = true;
  error.value = '';
  const inGroup = !!selectedGroup.value;
  try {
    const fields = {
      name: name.value,
      kind: kind.value,
      group: inGroup ? group.value : null,
      // Its own color only shows without a group; null draws a new one
      ...(inGroup ? { shade: shade.value } : { color: color.value }),
    };
    if (props.category) await api.updateCategory(props.category._id, fields);
    else await api.createCategory(fields);
    open.value = false;
    emit('saved');
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-md">
      <form class="flex flex-col gap-4" @submit.prevent="save">
        <DialogHeader>
          <DialogTitle>{{ editing ? 'Modifier la catégorie' : 'Nouvelle catégorie' }}</DialogTitle>
          <DialogDescription>Sa couleur la représente partout dans l'application.</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div class="flex flex-col gap-2">
            <Label for="category-name">Nom</Label>
            <Input id="category-name" v-model="name" placeholder="Épicerie" required />
          </div>
          <div class="flex flex-col gap-2">
            <Label>Type</Label>
            <Tabs v-model="kind">
              <TabsList class="w-full">
                <TabsTrigger value="expense">{{ CATEGORY_KINDS.expense }}</TabsTrigger>
                <TabsTrigger value="income">{{ CATEGORY_KINDS.income }}</TabsTrigger>
              </TabsList>
            </Tabs>
            <p v-if="kindChanged" class="text-sm text-muted-foreground">
              Les transactions déjà enregistrées gardent leur montant : seules les prochaines saisies prendront le signe
              du nouveau type.
            </p>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-2">
              <Label for="category-group">Groupe</Label>
              <OptionSelect id="category-group" v-model="groupSelect" :options="groupOptions" class="w-full">
                <template #after>
                  <SelectSeparator />
                  <SelectItem :value="NEW_GROUP">
                    <Plus />
                    Nouveau groupe…
                  </SelectItem>
                </template>
              </OptionSelect>
            </div>
            <!-- In a group, only shades of the group's color can be picked -->
            <div class="flex flex-col gap-2">
              <Label for="category-color">{{ selectedGroup ? 'Nuance' : 'Couleur' }}</Label>
              <CategoryColorPicker
                v-if="selectedGroup"
                id="category-color"
                v-model="shadeColor"
                :shades="scale"
                class="w-full"
              />
              <CategoryColorPicker v-else id="category-color" v-model="color" class="w-full" />
            </div>
          </div>

          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="saving" @click="onOpenChange(false)">Annuler</Button>
          <Button type="submit" :disabled="saving">
            {{ saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer la catégorie' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>

  <GroupDialog v-model:open="creatingGroup" @saved="onGroupCreated" />
</template>
