<script setup>
import { cn } from '@/lib/utils.js';
defineProps({ class: { type: [String, Array, Object], default: '' }, count: { type: Number, default: 1 } });
</script>
<template>
  <div v-for="n in count" :key="n" :class="cn('animate-pulse rounded-md bg-muted', $props.class)" />
</template>
