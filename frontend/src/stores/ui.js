import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

let toastId = 0;

export const useUiStore = defineStore('ui', () => {
  // ── theme (persisted) ──────────────────────────────────────────────
  const theme = ref(localStorage.getItem('cm_theme') || 'light'); // 'light' | 'dark'
  function applyTheme() {
    document.documentElement.classList.toggle('dark', theme.value === 'dark');
  }
  function toggleTheme() { theme.value = theme.value === 'dark' ? 'light' : 'dark'; }
  watch(theme, (v) => { localStorage.setItem('cm_theme', v); applyTheme(); }, { immediate: true });

  // ── toast queue ────────────────────────────────────────────────────
  const toasts = ref([]);
  function dismiss(id) { toasts.value = toasts.value.filter((t) => t.id !== id); }
  function push(type, message, opts = {}) {
    const id = ++toastId;
    toasts.value.push({ id, type, message, title: opts.title, duration: opts.duration ?? 4200 });
    if ((opts.duration ?? 4200) > 0) setTimeout(() => dismiss(id), opts.duration ?? 4200);
    return id;
  }
  const toast = {
    success: (m, o) => push('success', m, o),
    error: (m, o) => push('error', m, { duration: 6000, ...o }),
    info: (m, o) => push('info', m, o),
    warning: (m, o) => push('warning', m, o),
  };

  // ── global loading / command palette ───────────────────────────────
  const loading = ref(false);
  const sidebarOpen = ref(false);
  function withLoading(fn) {
    loading.value = true;
    return Promise.resolve().then(fn).finally(() => { loading.value = false; });
  }

  return { theme, applyTheme, toggleTheme, toasts, toast, dismiss, loading, sidebarOpen, withLoading };
});
