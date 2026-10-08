<script setup lang="ts">
// Pairs of transactions that look like the two sides of one transfer
// (same amount, opposite signs, two accounts, a few days apart), in a dialog
// (see useTransferReview). Closing it leaves the pairs for later: an icon next
// to the transactions card's title reopens them.
import type { TransferCandidate } from '@/types';
import { ref, watch } from 'vue';
import { ArrowRight } from '@lucide/vue';
import { api, formatCents, formatDate } from '@/api';
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
import { useTransferReview } from '@/composables/useTransferReview';

const emit = defineEmits<{ changed: []; error: [message: string] }>();

const { open, shown: candidates } = useTransferReview();

// Every pair handled: nothing left to show
watch(candidates, (list) => {
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

const ids = (c: TransferCandidate): [string, string] => [c.out._id, c.in._id];
const link = (c: TransferCandidate) => run(() => api.linkTransfer(ids(c)));
const ignore = (c: TransferCandidate) => run(() => api.ignoreTransfer(ids(c)));
const linkAll = () =>
  run(async () => {
    for (const c of candidates.value) await api.linkTransfer(ids(c));
  });
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Transferts à rapprocher</DialogTitle>
        <DialogDescription>
          {{ candidates.length > 1 ? 'Ces paires ressemblent' : 'Cette paire ressemble' }} aux deux côtés d'un même
          transfert entre tes comptes : même montant, signes opposés, à quelques jours d'écart. Tant qu'elles ne sont
          pas liées, elles comptent comme une dépense et un revenu ordinaires ; « Lier » les marque comme transfert
          (exclu de l'analyse).
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sortie</TableHead>
              <TableHead />
              <TableHead>Entrée</TableHead>
              <TableHead class="text-right">Montant</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="c in candidates" :key="c.out._id">
              <TableCell class="whitespace-normal">
                <div class="font-medium">{{ c.out.account.name }}</div>
                <div class="text-xs text-muted-foreground">{{ formatDate(c.out.date) }} · {{ c.out.description }}</div>
              </TableCell>
              <TableCell><ArrowRight class="size-4 text-muted-foreground" /></TableCell>
              <TableCell class="whitespace-normal">
                <div class="font-medium">{{ c.in.account.name }}</div>
                <div class="text-xs text-muted-foreground">
                  {{ formatDate(c.in.date) }} · {{ c.in.description }}
                  <template v-if="c.daysApart > 0">
                    ({{ c.daysApart }} jour{{ c.daysApart > 1 ? 's' : '' }} plus
                    {{ c.in.date > c.out.date ? 'tard' : 'tôt' }})
                  </template>
                </div>
              </TableCell>
              <TableCell class="text-right tabular-nums">{{ formatCents(c.in.amountCents) }}</TableCell>
              <TableCell class="text-right whitespace-nowrap">
                <Button size="sm" :disabled="busy" @click="link(c)">Lier</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  :disabled="busy"
                  title="Ne plus proposer cette paire"
                  @click="ignore(c)"
                >
                  Pas un transfert
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" @click="open = false">Plus tard</Button>
        <Button v-if="candidates.length > 1" :disabled="busy" @click="linkAll">
          Tout lier ({{ candidates.length }})
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
