<script setup lang="ts">
// The user's Google picture, or a person icon when there is none or it fails
// to load (offline...). `class` sizes both.
import type { HTMLAttributes } from 'vue';
import { ref, watch } from 'vue';
import { CircleUser } from '@lucide/vue';
import { cn } from '@/lib/utils';

const props = defineProps<{ picture: string | null; class?: HTMLAttributes['class'] }>();

const failed = ref(false);
watch(
  () => props.picture,
  () => (failed.value = false),
);
</script>

<template>
  <img
    v-if="picture && !failed"
    :src="picture"
    alt=""
    referrerpolicy="no-referrer"
    :class="cn('size-8 rounded-full', props.class)"
    @error="failed = true"
  />
  <CircleUser v-else :class="cn('size-8 text-muted-foreground', props.class)" />
</template>
