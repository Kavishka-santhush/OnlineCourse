<script setup>
import { cn } from '@/lib/utils.js';
defineProps({
  icon: { type: [Object, Function], default: null },
  title: { type: String, default: 'Nothing here yet' },
  description: { type: String, default: '' },
  class: { type: [String, Array, Object], default: '' },
});
</script>
<template>
  <div :class="cn('flex flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center', $props.class)">
    <component v-if="icon" :is="icon" class="mb-3 h-10 w-10 text-muted-foreground/60" />
    <h3 class="text-base font-semibold">{{ title }}</h3>
    <p v-if="description" class="mt-1 max-w-sm text-sm text-muted-foreground">{{ description }}</p>
    <div class="mt-4"><slot /></div>
  </div>
</template>
