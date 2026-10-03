<script setup lang="ts">
// One transaction, compact: account image, date over description, category,
// amount. "Modifier" in the actions menu asks the table to open the edit popup.
import type { Transaction } from '@/types';
import { computed, ref } from 'vue';
import { ArrowLeft, ArrowRight, Ellipsis, Link2, Pencil, Trash2 } from '@lucide/vue';
import { api, formatCents, formatDate } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableCell, TableRow } from '@/components/ui/table';
import AccountLogo from './AccountLogo.vue';
import ConfirmDialog from './ConfirmDialog.vue';

const props = defineProps<{ transaction: Transaction }>();
const emit = defineEmits<{ edit: []; changed: []; error: [message: string] }>();

const confirmOpen = ref(false);
const linked = computed(() => !!props.transaction.transferPeer);

async function remove() {
  try {
    await api.deleteTransaction(props.transaction._id);
    emit('changed');
  } catch (err) {
    emit('error', (err as Error).message);
  }
}
</script>

<template>
  <TableRow>
    <TableCell class="w-px pr-0">
      <span v-if="transaction.account" class="flex" :title="transaction.account.name">
        <AccountLogo :account="transaction.account" />
        <span class="sr-only">{{ transaction.account.name }}</span>
      </span>
    </TableCell>
    <TableCell class="whitespace-normal">
      <div class="text-xs text-muted-foreground">{{ formatDate(transaction.date) }}</div>
      <div class="break-words">{{ transaction.description }}</div>
      <div
        v-if="transaction.transferAccount"
        class="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"
        :title="linked ? 'Transfert lié à la transaction de l\'autre compte' : 'Transfert (autre côté non lié)'"
      >
        <component :is="transaction.amountCents < 0 ? ArrowRight : ArrowLeft" class="size-3.5 shrink-0" />
        {{ transaction.amountCents < 0 ? 'Vers' : 'De' }} {{ transaction.transferAccount.name }}
        <Link2 v-if="linked" class="size-3.5 shrink-0" />
      </div>
    </TableCell>
    <TableCell>
      <Badge v-if="transaction.transferAccount" variant="outline">Transfert</Badge>
      <Badge v-else-if="transaction.category" variant="outline" class="max-w-32" :title="transaction.category.name">
        <span class="truncate">{{ transaction.category.name }}</span>
      </Badge>
    </TableCell>
    <TableCell
      class="text-right tabular-nums"
      :class="transaction.amountCents < 0 ? 'text-destructive' : 'text-emerald-600'"
    >
      {{ formatCents(transaction.amountCents) }}
    </TableCell>
    <TableCell class="w-px pl-0 text-right">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button size="icon-sm" variant="ghost" aria-label="Actions" title="Actions">
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem @select="emit('edit')">
            <Pencil />
            Modifier
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" @select="confirmOpen = true">
            <Trash2 />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        v-model:open="confirmOpen"
        title="Supprimer cette transaction ?"
        :description="transaction.description"
        @confirm="remove"
      />
    </TableCell>
  </TableRow>
</template>
