<script setup lang="ts">
// Dialog listing every projection once, with its next date, to edit or delete.
// The search keeps the ones whose name, category, recurrence or amount match.
import type { Category, Projection } from '@/types';
import type { ProjectionRow } from './ProjectionTable.vue';
import { computed, ref, watch } from 'vue';
import { Search, X } from '@lucide/vue';
import { formatCents, formatDate } from '@/api';
import { nextDate, recurrenceLabel } from '@/lib/projections';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ProjectionTable from './ProjectionTable.vue';

const open = defineModel<boolean>('open', { required: true });
const props = defineProps<{ projections: Projection[]; categories: Category[] }>();
const emit = defineEmits<{ edit: [projection: Projection]; remove: [projection: Projection] }>();

const search = ref('');
// Each opening starts from the whole list
watch(open, (o) => {
  if (o) search.value = '';
});

// Accents and case do not matter: "electricite" finds "Électricité"
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
// Escape clears the search first, and only closes the dialog once it is empty
function clearOnEscape(e: KeyboardEvent) {
  if (!search.value) return;
  e.stopPropagation();
  search.value = '';
}
const query = computed(() => normalize(search.value.trim()));
const matches = (p: Projection) => {
  const category = props.categories.find((c) => c._id === p.category)?.name ?? '';
  const text = [p.name, category, recurrenceLabel(p), formatCents(p.amountCents)].join(' ');
  return normalize(text).includes(query.value);
};

const rows = computed<ProjectionRow[]>(() =>
  props.projections
    .filter((p) => !query.value || matches(p))
    .map((p) => {
      const next = nextDate(p);
      return {
        projection: p,
        date: next && formatDate(next),
        signedCents: p.kind === 'expense' ? -p.amountCents : p.amountCents,
      };
    }),
);
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Prévisions</DialogTitle>
        <DialogDescription>Chaque dépense prévue et compte à recevoir, avec sa prochaine date.</DialogDescription>
      </DialogHeader>
      <div class="relative">
        <Search class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          v-model="search"
          type="search"
          placeholder="Nom, catégorie, récurrence, montant…"
          aria-label="Rechercher une prévision"
          class="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
          @keydown.esc="clearOnEscape"
        />
        <Button
          v-if="search"
          variant="ghost"
          size="icon-xs"
          class="absolute top-1/2 right-1.5 -translate-y-1/2"
          aria-label="Effacer la recherche"
          @click="search = ''"
        >
          <X />
        </Button>
      </div>
      <DialogBody>
        <ProjectionTable
          :rows="rows"
          :categories="categories"
          date-label="Prochaine"
          editable
          :empty="search ? `Aucune prévision pour « ${search.trim()} »` : undefined"
          @edit="emit('edit', $event)"
          @remove="emit('remove', $event)"
        />
      </DialogBody>
    </DialogContent>
  </Dialog>
</template>
