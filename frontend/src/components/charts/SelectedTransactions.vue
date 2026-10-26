<script setup lang="ts">
// The transactions behind the clicked bar segment or donut slice, in the app's
// dialog (the bottom sheet on a phone), listed like everywhere else
import type { ChartSelection } from '@/lib/chartData';
import type { Transaction } from '@/types';
import { computed, ref, watch } from 'vue';
import { formatCents } from '@/api';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import TransactionList from '../TransactionList.vue';

const props = defineProps<{ selection: ChartSelection | null; transactions: Transaction[] }>();
const emit = defineEmits<{ close: [] }>();

// The last selection shown, kept while the dialog closes (its selection is
// already gone), so it does not flash empty on its way out
const shown = ref<{ label: string; transactions: Transaction[] } | null>(null);
watch(
  () => [props.selection, props.transactions] as const,
  ([selection, transactions]) => {
    if (selection) shown.value = { label: selection.label, transactions };
  },
  { immediate: true },
);
const total = computed(() => (shown.value?.transactions ?? []).reduce((sum, t) => sum - t.amountCents, 0));
</script>

<template>
  <Dialog :open="!!selection" @update:open="(open) => !open && emit('close')">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ shown?.label }}</DialogTitle>
        <DialogDescription>
          {{ shown?.transactions.length ?? 0 }} transaction(s) · {{ formatCents(total) }}
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <TransactionList :transactions="shown?.transactions ?? []" />
      </DialogBody>
    </DialogContent>
  </Dialog>
</template>
