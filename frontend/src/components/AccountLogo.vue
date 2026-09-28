<script setup lang="ts">
// The account's image, or a neutral bank icon when it has none
import type { HTMLAttributes } from 'vue';
import type { Account } from '@/types';
import { computed } from 'vue';
import { Landmark } from '@lucide/vue';
import { accountLogoUrl } from '@/api';
import { cn } from '@/lib/utils';

const props = defineProps<{
  account: Pick<Account, '_id' | 'name' | 'logoUpdatedAt'>;
  class?: HTMLAttributes['class'];
}>();

const url = computed(() => accountLogoUrl(props.account));
</script>

<template>
  <img
    v-if="url"
    :src="url"
    :alt="account.name"
    :class="cn('size-5 shrink-0 rounded object-contain', props.class)"
  />
  <span
    v-else
    :class="cn('flex size-5 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground', props.class)"
    aria-hidden="true"
  >
    <Landmark class="size-3/5" />
  </span>
</template>
