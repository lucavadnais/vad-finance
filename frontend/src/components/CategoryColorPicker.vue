<script setup lang="ts">
// Color of a group or of a category without group: a button opening the
// palette, plus a custom color (saturation/brightness area, hue slider, hex
// field), all built on reka-ui's color primitives. null = "Au hasard": the
// backend draws one of the least used colors.
// With `shades` (a category in a group), only those swatches are offered, and
// null means "Automatique" (a shade spread among the group's categories).
import type { HTMLAttributes } from 'vue';
import { computed, ref, watch } from 'vue';
import { Check, Shuffle, Sparkles } from '@lucide/vue';
import {
  ColorAreaArea,
  ColorAreaRoot,
  ColorAreaThumb,
  ColorFieldInput,
  ColorFieldRoot,
  ColorSliderRoot,
  ColorSliderThumb,
  ColorSliderTrack,
  ColorSwatch,
  ColorSwatchPickerItem,
  ColorSwatchPickerItemIndicator,
  ColorSwatchPickerItemSwatch,
  ColorSwatchPickerRoot,
} from 'reka-ui';
import { PALETTE } from '@/lib/colors';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const model = defineModel<string | null>({ required: true });
const props = defineProps<{
  id?: string;
  class?: HTMLAttributes['class'];
  shades?: string[];
}>();

const nullLabel = computed(() => (props.shades ? 'Automatique' : 'Au hasard'));

const open = ref(false);
// Custom color being picked, applied with "Appliquer"
const draft = ref(PALETTE[0]!);

// Every opening starts the custom color from the current one
watch(open, (value) => {
  if (value) draft.value = model.value ?? PALETTE[0]!;
});

function choose(color: string | null) {
  model.value = color?.toLowerCase() ?? null;
  open.value = false;
}

// reka's swatches expose their color as a CSS variable, painted here
const swatch = 'block shrink-0 border border-black/10 bg-(--reka-color-swatch-color)';
const thumb =
  'block size-4 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.3)] outline-none focus-visible:ring-3 focus-visible:ring-ring/50';
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        :id="id"
        type="button"
        variant="outline"
        :class="cn('justify-start font-normal', props.class)"
        :aria-label="model ? `Couleur ${model}` : `Couleur : ${nullLabel.toLowerCase()}`"
      >
        <ColorSwatch v-if="model" :color="model" :class="[swatch, 'size-4 rounded-full']" />
        <component :is="shades ? Sparkles : Shuffle" v-else class="text-muted-foreground" />
        <span :class="!model && 'text-muted-foreground'">{{ model ? 'Couleur' : nullLabel }}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent class="flex w-64 flex-col gap-3 p-3" align="start">
      <!-- Palette (or the group's shades): picking a swatch applies it -->
      <ColorSwatchPickerRoot
        :model-value="model ?? undefined"
        class="grid gap-1.5"
        :class="shades ? 'grid-cols-9' : 'grid-cols-8'"
        :aria-label="shades ? 'Nuances du groupe' : 'Palette'"
        @update:model-value="(value) => typeof value === 'string' && choose(value)"
      >
        <ColorSwatchPickerItem
          v-for="c in shades ?? PALETTE"
          :key="c"
          :value="c"
          class="relative flex size-6 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-highlighted:ring-2 data-highlighted:ring-ring/50"
        >
          <ColorSwatchPickerItemSwatch :class="[swatch, 'absolute inset-0 rounded-full']" />
          <ColorSwatchPickerItemIndicator class="relative text-white">
            <Check class="size-3.5 drop-shadow-[0_0_1px_rgb(0_0_0/0.6)]" />
          </ColorSwatchPickerItemIndicator>
        </ColorSwatchPickerItem>
      </ColorSwatchPickerRoot>

      <!-- Custom color: saturation and brightness, hue, hex. Not for a shade -->
      <div v-if="!shades" class="flex flex-col gap-2 border-t pt-3">
        <span class="text-sm font-medium">Personnalisée</span>
        <ColorAreaRoot
          v-slot="{ style }"
          v-model="draft"
          color-space="hsb"
          x-channel="saturation"
          y-channel="brightness"
          class="block"
        >
          <!-- The gradient comes from the root -->
          <ColorAreaArea class="relative h-28 w-full rounded-md" :style="style">
            <ColorAreaThumb :class="thumb" />
          </ColorAreaArea>
        </ColorAreaRoot>
        <ColorSliderRoot
          :model-value="draft"
          color-space="hsb"
          channel="hue"
          class="relative flex h-4 w-full touch-none items-center select-none"
          @update:model-value="(value) => typeof value === 'string' && (draft = value)"
        >
          <ColorSliderTrack class="relative h-3 w-full grow rounded-full" />
          <ColorSliderThumb :class="thumb" aria-label="Teinte" />
        </ColorSliderRoot>
        <div class="flex items-center gap-2">
          <ColorSwatch :color="draft" :class="[swatch, 'size-8 rounded-md']" />
          <ColorFieldRoot v-model="draft" class="min-w-0 flex-1">
            <ColorFieldInput
              aria-label="Code hexadécimal"
              class="h-8 w-full rounded-md border border-input bg-transparent px-2 font-mono text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </ColorFieldRoot>
          <Button type="button" size="sm" @click="choose(draft)">Appliquer</Button>
        </div>
      </div>

      <Button type="button" size="sm" variant="ghost" class="self-start" @click="choose(null)">
        <component :is="shades ? Sparkles : Shuffle" />
        {{ nullLabel }}
      </Button>
    </PopoverContent>
  </Popover>
</template>
