<script setup lang="ts">
// Pairs of transactions that look like the two sides of one transfer
// (same amount, opposite signs, two accounts, a few days apart)
import type { TransferCandidate } from '@/types';
import { ref } from 'vue';
import { ArrowRight } from '@lucide/vue';
import { api, formatCents, formatDate } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const props = defineProps<{ candidates: TransferCandidate[] }>();
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

const ids = (c: TransferCandidate): [string, string] => [c.out._id, c.in._id];
const link = (c: TransferCandidate) => run(() => api.linkTransfer(ids(c)));
const ignore = (c: TransferCandidate) => run(() => api.ignoreTransfer(ids(c)));
const linkAll = () =>
  run(async () => {
    for (const c of props.candidates) await api.linkTransfer(ids(c));
  });
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Transferts à rapprocher</CardTitle>
      <CardDescription>
        Ces paires ressemblent aux deux côtés d'un même transfert entre tes comptes : même montant,
        signes opposés, à quelques jours d'écart. Tant qu'elles ne sont pas confirmées, elles comptent
        comme une dépense et un revenu ordinaires ; « Lier » les marque comme transfert (exclu de
        l'analyse) et relie les deux côtés.
      </CardDescription>
      <CardAction>
        <Button :disabled="busy" @click="linkAll">Tout lier ({{ candidates.length }})</Button>
      </CardAction>
    </CardHeader>
    <CardContent>
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
              <div class="text-xs text-muted-foreground">
                {{ formatDate(c.out.date) }} · {{ c.out.description }}
              </div>
            </TableCell>
            <TableCell><ArrowRight class="size-4 text-muted-foreground" /></TableCell>
            <TableCell class="whitespace-normal">
              <div class="font-medium">{{ c.in.account.name }}</div>
              <div class="text-xs text-muted-foreground">
                {{ formatDate(c.in.date) }} · {{ c.in.description }}
                <template v-if="c.daysApart > 0">
                  ({{ c.daysApart }} jour{{ c.daysApart > 1 ? 's' : '' }} plus {{ c.in.date > c.out.date ? 'tard' : 'tôt' }})
                </template>
              </div>
            </TableCell>
            <TableCell class="text-right tabular-nums">{{ formatCents(c.in.amountCents) }}</TableCell>
            <TableCell class="text-right whitespace-nowrap">
              <Button size="sm" :disabled="busy" @click="link(c)">Lier</Button>
              <Button size="sm" variant="ghost" :disabled="busy" @click="ignore(c)">Ignorer</Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </CardContent>
  </Card>
</template>
