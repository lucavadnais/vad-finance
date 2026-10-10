<script setup lang="ts">
// Saved transactions that may be the same one (same account and amount, a few
// days apart): delete one side, or mark the pair as not a duplicate. In a
// dialog (see useDuplicateReview); closing it leaves the pairs for later, an icon next
// to the transactions card's title reopens them.
import type { DuplicatePair, TransferSide } from '@/types';
import { ref, watch } from 'vue';
import { Trash2 } from '@lucide/vue';
import { api, formatCents, formatDate } from '@/api';
import { Badge } from '@/components/ui/badge';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { duplicateKey, useDuplicateReview } from '@/composables/useDuplicateReview';
import ConfirmDialog from './ConfirmDialog.vue';

const emit = defineEmits<{ changed: []; error: [message: string] }>();

const { open, shown: pairs } = useDuplicateReview();

// Every pair resolved: nothing left to show
watch(pairs, (list) => {
  if (list.length === 0) open.value = false;
});

const busy = ref(false);

async function run(action: () => Promise<unknown>) {
  busy.value = true;
  try {
    await action();
    emit('changed');
  } catch (err) {
    emit('error', (err as Error).message);
  } finally {
    busy.value = false;
  }
}

// One confirmation for the whole list, outside the rows: the row of a deleted
// transaction goes away, a confirmation inside it would be torn down while
// closing (and leave the page unclickable)
const toDelete = ref<TransferSide | null>(null);
const confirmOpen = ref(false);
function askDelete(t: TransferSide) {
  toDelete.value = t;
  confirmOpen.value = true;
}
function remove() {
  const t = toDelete.value;
  if (t) run(() => api.deleteTransaction(t._id));
}
const ignore = (p: DuplicatePair) => run(() => api.ignoreDuplicate([p.a._id, p.b._id]));
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Doublons possibles</DialogTitle>
        <DialogDescription>
          Même compte et même montant, à 3 jours d'écart au plus. Supprimez celle en trop, ou indiquez que ce ne sont pas
          des doublons.
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Compte</TableHead>
              <TableHead>Transactions</TableHead>
              <TableHead class="text-right">Montant</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="p in pairs" :key="duplicateKey(p)">
              <TableCell class="align-top font-medium">{{ p.a.account.name }}</TableCell>
              <TableCell class="whitespace-normal">
                <Badge :variant="p.kind === 'exact' ? 'secondary' : 'outline'" class="mb-1.5">
                  {{ p.kind === 'exact' ? 'Identiques' : 'Similaires' }}
                </Badge>
                <div v-for="t in [p.a, p.b]" :key="t._id" class="flex items-center gap-2 text-sm">
                  <span class="text-muted-foreground tabular-nums">{{ formatDate(t.date) }}</span>
                  <span class="flex-1">{{ t.description || '—' }}</span>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    :disabled="busy"
                    aria-label="Supprimer celle-ci"
                    @click="askDelete(t)"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </TableCell>
              <TableCell class="align-top text-right tabular-nums">{{ formatCents(p.a.amountCents) }}</TableCell>
              <TableCell class="align-top text-right">
                <Button size="sm" variant="outline" :disabled="busy" @click="ignore(p)">Pas un doublon</Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" @click="open = false">Plus tard</Button>
      </DialogFooter>
      <ConfirmDialog
        v-model:open="confirmOpen"
        title="Supprimer cette transaction ?"
        :description="
          toDelete
            ? `${formatDate(toDelete.date)} · ${toDelete.description} · ${formatCents(toDelete.amountCents)}`
            : ''
        "
        @confirm="remove"
      />
    </DialogContent>
  </Dialog>
</template>
