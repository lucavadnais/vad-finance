<script setup lang="ts">
// Spending against the usual by the same day (see lib/spending.ts), as a
// sentence: red above it, green below, "Comme d'habitude" within a few
// percent. The home's spending tile, and the spending tab's chart legend
// (`dot`: the gray dot of the chart's median line before "d'habitude").
// `previous`: against the period before instead of the usual. `info`: an info
// icon explaining the usual (not inside a button: it is one itself).
import { ArrowDown, ArrowUp } from '@lucide/vue';
import { createReusableTemplate } from '@vueuse/core';
import InfoTooltip from './InfoTooltip.vue';

withDefaults(
  defineProps<{ percent: number; dot?: boolean; align?: 'start' | 'end'; previous?: boolean; info?: boolean }>(),
  { dot: false, align: 'start', previous: false, info: false },
);

// The info icon, after either sentence
const [DefineUsualInfo, UsualInfo] = createReusableTemplate();
</script>

<template>
  <DefineUsualInfo>
    <InfoTooltip label="Qu'est-ce que l'habitude ?">
      Ce que vous dépensez habituellement à cette date du mois : le montant du milieu parmi vos 3 derniers mois, pour
      qu'un mois inhabituel ne fausse pas la comparaison.
    </InfoTooltip>
  </DefineUsualInfo>
  <span class="flex flex-col text-sm" :class="align === 'end' ? 'items-end' : 'items-start'">
    <span v-if="Math.abs(percent) < 3" class="flex items-center gap-1.5 text-muted-foreground">
      <span v-if="dot" class="size-2.5 rounded-full bg-[var(--brand-gray)]" />
      {{ previous ? 'Comme la période précédente' : "Comme d'habitude" }}
      <UsualInfo v-if="info && !previous" />
    </span>
    <template v-else>
      <span
        class="flex items-center gap-1 font-medium tabular-nums"
        :class="percent > 0 ? 'text-destructive' : 'text-emerald-600'"
      >
        <ArrowUp v-if="percent > 0" class="size-4 shrink-0" />
        <ArrowDown v-else class="size-4 shrink-0" />
        {{ Math.abs(percent) }} % de {{ percent > 0 ? 'plus' : 'moins' }}
      </span>
      <span class="flex items-center gap-1.5 text-muted-foreground">
        <span v-if="dot" class="size-2.5 rounded-full bg-[var(--brand-gray)]" />
        {{ previous ? 'que la période précédente' : "que d'habitude" }}
        <UsualInfo v-if="info && !previous" />
      </span>
    </template>
  </span>
</template>
