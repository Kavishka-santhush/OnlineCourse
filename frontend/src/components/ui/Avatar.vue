<script setup>
import { computed } from 'vue';
import { cn, initials } from '@/lib/utils.js';
const props = defineProps({
  src: { type: String, default: null },
  name: { type: String, default: '' },
  size: { type: String, default: 'md' }, // sm|md|lg|xl
  class: { type: [String, Array, Object], default: '' },
});
const dims = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-base', xl: 'h-24 w-24 text-2xl' };
const sizeClass = computed(() => dims[props.size] || dims.md);
</script>
<template>
  <span :class="cn('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-semibold text-muted-foreground', sizeClass, $props.class)">
    <img v-if="src" :src="src" :alt="name" class="h-full w-full object-cover" loading="lazy" />
    <span v-else>{{ initials(name) }}</span>
  </span>
</template>
