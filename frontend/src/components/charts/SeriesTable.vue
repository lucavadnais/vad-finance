<script setup lang="ts">
// Table view of a chart: the same numbers without color or hover
import type { Row, Series } from '@/lib/chartData';
import { formatCents } from '@/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

defineProps<{
  rows: Row[];
  series: Series[];
  bucketLabel: string;
  formatBucket?: (row: Row) => string;
  showTotal?: boolean;
}>();

const total = (row: Row, series: Series[]) => series.reduce((sum, s) => sum + Number(row[s.key] ?? 0), 0);
</script>

<template>
  <div class="max-h-80 overflow-y-auto rounded-md border">
    <Table>
      <TableHeader class="sticky top-0 bg-background">
        <TableRow>
          <TableHead>{{ bucketLabel }}</TableHead>
          <TableHead v-for="s in series" :key="s.key" class="text-right">{{ s.label }}</TableHead>
          <TableHead v-if="showTotal" class="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="row in rows" :key="row.t">
          <TableCell class="whitespace-nowrap">{{ formatBucket ? formatBucket(row) : row.label }}</TableCell>
          <TableCell v-for="s in series" :key="s.key" class="text-right tabular-nums">
            {{ formatCents(Number(row[s.key] ?? 0)) }}
          </TableCell>
          <TableCell v-if="showTotal" class="text-right font-medium tabular-nums">
            {{ formatCents(total(row, series)) }}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
