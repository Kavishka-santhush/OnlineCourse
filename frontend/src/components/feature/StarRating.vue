<script setup>
import { Star } from 'lucide-vue-next';
import { cn } from '@/lib/utils.js';
const props = defineProps({
  value: { type: Number, default: 0 },
  count: { type: Number, default: null },
  size: { type: String, default: 'sm' }, // sm|md|lg
  class: { type: [String, Array, Object], default: '' },
});
const dims = { sm: 'h-3.5 w-3.5', md: 'h-5 w-5', lg: 'h-6 w-6' };
</script>
<template>
  <div :class="cn('inline-flex items-center gap-1', $props.class)">
    <div class="relative inline-flex">
      <div class="flex text-muted-foreground/40">
        <Star v-for="i in 5" :key="'b' + i" :class="cn(dims[size], 'shrink-0')" fill="currentColor" />
      </div>
      <div class="absolute inset-0 flex overflow-hidden text-amber-400" :style="{ width: (value / 5) * 100 + '%' }">
        <Star v-for="i in 5" :key="'f' + i" :class="cn(dims[size], 'shrink-0')" fill="currentColor" />
      </div>
    </div>
    <span v-if="count !== null" class="text-sm text-muted-foreground">{{ Number(value).toFixed(1) }} ({{ count }})</span>
    <slot name="suffix" />
  </div>
</template>
