<script setup>
import { cn } from '@/lib/utils.js';
defineProps({ for: { type: String, default: undefined }, class: { type: [String, Array, Object], default: '' } });
</script>
<template>
  <label :for="for" :class="cn('text-sm font-medium leading-none text-foreground peer-disabled:opacity-70', $props.class)">
    <slot />
  </label>
</template>
