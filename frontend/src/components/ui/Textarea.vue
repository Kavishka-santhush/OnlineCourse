<script setup>
import { cn } from '@/lib/utils.js';
defineProps({
  modelValue: { type: [String, Number], default: '' },
  class: { type: [String, Array, Object], default: '' },
  rows: { type: Number, default: 4 },
});
defineEmits(['update:modelValue']);
</script>
<template>
  <textarea
    :rows="rows"
    :value="modelValue"
    @input="$emit('update:modelValue', $event.target.value)"
    :class="cn(
      'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
      $props.class)" />
</template>
