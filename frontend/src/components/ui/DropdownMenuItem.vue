<script setup>
import { cn } from '@/lib/utils.js';
defineProps({ href: { type: String, default: undefined }, to: { type: [String, Object], default: undefined }, danger: { type: Boolean, default: false }, class: { type: [String, Array, Object], default: '' } });
</script>
<template>
  <RouterLink v-if="to" :to="to" :class="cn('flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground', danger && 'text-destructive hover:text-destructive', $props.class)"><slot /></RouterLink>
  <a v-else-if="href" :href="href" :class="cn('flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm hover:bg-accent', danger && 'text-destructive', $props.class)"><slot /></a>
  <button v-else type="button" :class="cn('flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground', danger && 'text-destructive hover:text-destructive', $props.class)"><slot /></button>
</template>
