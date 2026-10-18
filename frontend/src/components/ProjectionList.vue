<script setup lang="ts">
// Every projection once, with its next date, to edit or delete. The search
// keeps the ones whose name, category, recurrence or amount match. In the
// "Gérer les prévisions" dialog.
import type { Category, Projection } from '@/types';
import type { ProjectionRow } from './ProjectionTable.vue';
import { computed, ref } from 'vue';
import { formatCents, formatDate } from '@/api';
import { nextDate, recurrenceLabel } from '@/lib/projections';
import { SearchX } from '@lucide/vue';
import { normalizeText } from '@/lib/text';
import ProjectionTable from './ProjectionTable.vue';
import SearchInput from './SearchInput.vue';

const props = defineProps<{ projections: Projection[]; categories: Category[] }>();
const emit = defineEmits<{ add: []; edit: [projection: Projection]; remove: [projection: Projection] }>();

const search = ref('');

// Accents and case do not matter: "electricite" finds "Électricité"
const query = computed(() => normalizeText(search.value));
const matches = (p: Projection) => {
  const category = props.categories.find((c) => c._id === p.category)?.name ?? '';
  const text = [p.name, category, recurrenceLabel(p), formatCents(p.amountCents)].join(' ');
  return normalizeText(text).includes(query.value);
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
  <div class="flex flex-col gap-4">
    <!-- The search, and the parent's actions beside it (`actions` slot) -->
    <div class="flex items-center gap-2">
      <SearchInput
        v-model="search"
        class="min-w-0 flex-1"
        placeholder="Nom, catégorie, récurrence, montant…"
        label="Rechercher une prévision"
      />
      <slot name="actions" />
    </div>
    <ProjectionTable
      :rows="rows"
      :categories="categories"
      date-label="Prochaine"
      editable
      :empty="search ? `Aucune prévision pour « ${search.trim()} »` : undefined"
      :empty-icon="search ? SearchX : undefined"
      :empty-action="search ? undefined : 'Ajouter une prévision'"
      @add="emit('add')"
      @edit="emit('edit', $event)"
      @remove="emit('remove', $event)"
    />
  </div>
</template>
