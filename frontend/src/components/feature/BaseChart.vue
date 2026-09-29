<script setup>
import { computed } from 'vue';
import { Line, Bar, Doughnut, Pie, PolarArea, Scatter } from 'vue-chartjs';
import { baseOptions, PALETTE } from '@/lib/chart.js';

const props = defineProps({
  type: { type: String, default: 'line' }, // line|bar|doughnut|pie|polarArea|scatter
  data: { type: Object, required: true },
  options: { type: Object, default: () => ({}) },
  height: { type: Number, default: 260 },
});

const registry = { line: Line, bar: Bar, doughnut: Doughnut, pie: Pie, polarArea: PolarArea, scatter: Scatter };
const cmp = computed(() => registry[props.type] || Line);
const opts = computed(() => baseOptions(props.options));

// Convenience: color a single-dataset chart's elements from the palette.
const coloredData = computed(() => {
  const d = props.data;
  if (!d?.datasets) return d;
  return {
    ...d,
    datasets: d.datasets.map((ds, i) => ({
      borderColor: ds.borderColor || PALETTE[i % PALETTE.length],
      backgroundColor: ds.backgroundColor || (['doughnut', 'pie', 'polarArea'].includes(props.type)
        ? d.labels?.map((_, j) => PALETTE[j % PALETTE.length]) || PALETTE[0]
        : `${PALETTE[i % PALETTE.length]}33`),
      ...ds,
    })),
  };
});
</script>

<template>
  <div :style="{ height: height + 'px' }">
    <component :is="cmp" :data="coloredData" :options="opts" />
  </div>
</template>
