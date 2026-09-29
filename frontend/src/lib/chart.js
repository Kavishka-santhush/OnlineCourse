// Central Chart.js registration + theme-aware defaults for vue-chartjs.
// Import this once (BaseChart does) so every chart shares the same palette.
import {
  Chart, CategoryScale, LinearScale, RadialLinearScale, LogarithmicScale,
  TimeScale, PointElement, LineElement, BarElement, ArcElement, Filler,
  Tooltip, Legend, Title,
} from 'chart.js';

Chart.register(
  CategoryScale, LinearScale, RadialLinearScale, LogarithmicScale, TimeScale,
  PointElement, LineElement, BarElement, ArcElement, Filler,
  Tooltip, Legend, Title,
);

export const PALETTE = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4',
  '#a855f7', '#ec4899', '#84cc16', '#f97316', '#14b8a6',
];

/** Read CSS variables so charts follow light/dark theme. */
function cssVar(name, fallback) {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `hsl(${v})` : fallback;
}

export function baseOptions(extra = {}) {
  const fg = cssVar('--foreground', '222 47% 11%');
  const muted = cssVar('--muted-foreground', '215 16% 47%');
  const grid = cssVar('--border', '214 32% 91%');
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: fg, usePointStyle: true, boxWidth: 8 } },
      tooltip: { bodyColor: fg, titleColor: fg },
    },
    scales: {
      x: { ticks: { color: muted }, grid: { color: grid } },
      y: { ticks: { color: muted }, grid: { color: grid } },
    },
    ...extra,
  };
}

export { Chart };
