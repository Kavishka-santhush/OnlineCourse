import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

/** Tailwind-aware className combiner (shadcn-vue `cn`). */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** Format a major-unit amount (e.g. 89.99) as currency. */
export function money(value, currency = 'usd') {
  const num = Number(value || 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(num);
}

/** Format an amount already stored in cents. */
export function moneyCents(cents, currency = 'usd') {
  return money((Number(cents || 0)) / 100, currency);
}

export function formatDate(d, pattern = 'DD MMM YYYY') {
  return d ? dayjs(d).format(pattern) : '—';
}

export function fromNow(d) {
  return d ? dayjs(d).fromNow() : '';
}

/** Turn a duration in seconds into "1h 24m" / "12m" / "45s". */
export function duration(seconds) {
  const s = Number(seconds || 0);
  if (!s) return '0m';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${s}s`;
}

/** Compact number: 1280 -> "1.3k". */
export function compact(n) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n || 0));
}

export function initials(name = '') {
  return name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
}

/** Placeholder gradient thumbnail when a course has no image. */
export function slugToTitle(slug = '') {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function truncate(str = '', len = 120) {
  return str.length > len ? str.slice(0, len - 1).trimEnd() + '…' : str;
}

/** Read a nested file upload as a base64 data URL (for the API uploadBuffer). */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
