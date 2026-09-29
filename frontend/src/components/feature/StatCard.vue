<script setup>
import { cn } from '@/lib/utils.js';
defineProps({
  label: { type: String, default: '' },
  value: { type: [String, Number], default: '' },
  hint: { type: String, default: '' },
  icon: { type: [Object, Function], default: null },
  trend: { type: Number, default: null },
  class: { type: [String, Array, Object], default: '' },
});
</script>
<template>
  <div :class="cn('rounded-xl border bg-card p-5 shadow-sm', $props.class)">
    <div class="flex items-start justify-between">
      <div>
        <p class="text-sm text-muted-foreground">{{ label }}</p>
        <p class="mt-1 text-2xl font-bold tracking-tight">{{ value }}</p>
      </div>
      <div v-if="icon" class="rounded-lg bg-primary/10 p-2 text-primary"><component :is="icon" class="h-5 w-5" /></div>
    </div>
    <p v-if="hint || trend !== null" class="mt-2 text-xs text-muted-foreground">
      <span v-if="trend !== null" :class="trend >= 0 ? 'text-emerald-600' : 'text-red-600'">
        {{ trend >= 0 ? '▲' : '▼' }} {{ Math.abs(trend) }}%
      </span>
      {{ hint }}
    </p>
  </div>
</template>
