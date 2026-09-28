<script setup lang="ts">
// Saved transactions that may be the same one (same account and amount, a few
// days apart): delete one side, or mark the pair as not a duplicate
import type { DuplicatePair, TransferSide } from '@/types';
import { ref } from 'vue';
import { Trash2 } from '@lucide/vue';
import { api, formatCents, formatDate } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import ConfirmDialog from './ConfirmDialog.vue';

defineProps<{ pairs: DuplicatePair[] }>();
const emit = defineEmits<{ changed: []; error: [message: string] }>();

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

const remove = (t: TransferSide) => run(() => api.deleteTransaction(t._id));
const ignore = (p: DuplicatePair) => run(() => api.ignoreDuplicate([p.a._id, p.b._id]));
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Doublons possibles</CardTitle>
      <CardDescription>
        Même compte et même montant, à 3 jours d'écart au plus. Supprime celle en trop, ou indique que
        ce ne sont pas des doublons.
      </CardDescription>
    </CardHeader>
    <CardContent>
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
          <TableRow v-for="p in pairs" :key="`${p.a._id}-${p.b._id}`">
            <TableCell class="align-top font-medium">{{ p.a.account.name }}</TableCell>
            <TableCell class="whitespace-normal">
              <Badge :variant="p.kind === 'exact' ? 'secondary' : 'outline'" class="mb-1.5">
                {{ p.kind === 'exact' ? 'Identiques' : 'Similaires' }}
              </Badge>
              <div v-for="t in [p.a, p.b]" :key="t._id" class="flex items-center gap-2 text-sm">
                <span class="text-muted-foreground tabular-nums">{{ formatDate(t.date) }}</span>
                <span class="flex-1">{{ t.description || '—' }}</span>
                <ConfirmDialog
                  title="Supprimer cette transaction ?"
                  :description="`${formatDate(t.date)} · ${t.description} · ${formatCents(t.amountCents)}`"
                  @confirm="remove(t)"
                >
                  <Button size="icon-xs" variant="ghost" :disabled="busy" aria-label="Supprimer celle-ci">
                    <Trash2 />
                  </Button>
                </ConfirmDialog>
              </div>
            </TableCell>
            <TableCell class="align-top text-right tabular-nums">{{ formatCents(p.a.amountCents) }}</TableCell>
            <TableCell class="align-top text-right">
              <Button size="sm" variant="outline" :disabled="busy" @click="ignore(p)">
                Pas un doublon
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </CardContent>
  </Card>
</template>
