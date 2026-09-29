<script setup>
import { computed } from 'vue';
import { cn } from '@/lib/utils.js';
const props = defineProps({
  modelValue: { type: Number, default: 0 }, // 0..100
  class: { type: [String, Array, Object], default: '' },
  color: { type: String, default: 'bg-primary' },
});
const pct = computed(() => Math.max(0, Math.min(100, Number(props.modelValue) || 0)));
</script>
<template>
  <div :class="cn('h-2 w-full overflow-hidden rounded-full bg-secondary', $props.class)" role="progressbar" :aria-valuenow="pct">
    <div :class="cn('h-full rounded-full transition-all', color)" :style="{ width: pct + '%' }" />
  </div>
</template>
