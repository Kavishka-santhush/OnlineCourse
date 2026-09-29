<script setup>
import { computed } from 'vue';
import { cn } from '@/lib/utils.js';

const props = defineProps({
  variant: { type: String, default: 'default' }, // default|secondary|outline|ghost|destructive|link
  size: { type: String, default: 'default' },     // default|sm|lg|icon
  as: { type: String, default: 'button' },
  to: { type: [String, Object], default: undefined },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  class: { type: [String, Array, Object], default: '' },
});

const variants = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
  link: 'text-primary underline-offset-4 hover:underline',
};
const sizes = {
  default: 'h-10 px-4 py-2',
  sm: 'h-9 rounded-md px-3 text-sm',
  lg: 'h-11 rounded-md px-6 text-base',
  icon: 'h-10 w-10',
};
const classes = computed(() =>
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    variants[props.variant], sizes[props.size], props.class,
  ),
);
</script>

<template>
  <RouterLink v-if="to" :to="to" :class="classes">
    <slot />
  </RouterLink>
  <a v-else-if="as === 'a'" :class="classes"><slot /></a>
  <button v-else :class="classes" :disabled="disabled || loading">
    <svg v-if="loading" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
    <slot v-else name="icon" />
    <slot />
  </button>
</template>
