<script setup>
import { cn } from '@/lib/utils.js';
const props = defineProps({ modelValue: { type: Boolean, default: false }, disabled: { type: Boolean, default: false } });
const emit = defineEmits(['update:modelValue']);
function toggle() { if (!props.disabled) emit('update:modelValue', !props.modelValue); }
</script>
<template>
  <button type="button" role="switch" :aria-checked="modelValue" :disabled="disabled" @click="toggle"
    :class="cn('inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
      modelValue ? 'bg-primary' : 'bg-input')">
    <span :class="cn('h-5 w-5 transform rounded-full bg-white shadow transition-transform', modelValue ? 'translate-x-5' : 'translate-x-0.5')" />
  </button>
</template>
