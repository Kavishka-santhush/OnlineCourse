<script setup>
import { cn } from '@/lib/utils.js';
defineProps({
  variant: { type: String, default: 'default' }, // default|secondary|outline|destructive|success|muted
  class: { type: [String, Array, Object], default: '' },
});
const variants = {
  default: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  outline: 'text-foreground border border-input',
  destructive: 'bg-destructive text-destructive-foreground',
  success: 'bg-emerald-500 text-white',
  muted: 'bg-muted text-muted-foreground',
};
</script>
<template>
  <span :class="cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', variants[variant], $props.class)">
    <slot />
  </span>
</template>
