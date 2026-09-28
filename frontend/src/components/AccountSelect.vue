<script setup lang="ts">
// Account picker showing each account's image, in the list and once chosen
import type { HTMLAttributes } from 'vue';
import type { Account } from '@/types';
import { computed } from 'vue';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import AccountLogo from './AccountLogo.vue';

const model = defineModel<string>();
const props = withDefaults(
  defineProps<{
    accounts: Account[];
    placeholder?: string;
    id?: string;
    class?: HTMLAttributes['class'];
  }>(),
  { placeholder: 'Choisir le compte' },
);

const selected = computed(() => props.accounts.find((a) => a._id === model.value));
</script>

<template>
  <Select v-model="model">
    <SelectTrigger :id="id" :class="props.class">
      <!-- Custom content: SelectValue alone only shows the item's text, not its image -->
      <SelectValue :placeholder="placeholder">
        <span v-if="selected" class="flex min-w-0 items-center gap-2">
          <AccountLogo :account="selected" />
          <span class="truncate">{{ selected.name }}</span>
        </span>
        <template v-else>{{ placeholder }}</template>
      </SelectValue>
    </SelectTrigger>
    <SelectContent>
      <SelectItem v-for="a in accounts" :key="a._id" :value="a._id">
        <AccountLogo :account="a" />
        {{ a.name }}
      </SelectItem>
    </SelectContent>
  </Select>
</template>
