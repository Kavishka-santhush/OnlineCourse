<script setup>
import { cn } from '@/lib/utils.js';
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  tabs: { type: Array, required: true }, // [{ value, label }]
  class: { type: [String, Array, Object], default: '' },
});
const emit = defineEmits(['update:modelValue']);
</script>
<template>
  <div :class="cn('inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1', $props.class)">
    <button
      v-for="t in tabs" :key="t.value" type="button"
      @click="emit('update:modelValue', t.value)"
      :class="cn(
        'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        modelValue === t.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')">
      {{ t.label }}
    </button>
  </div>
</template>
