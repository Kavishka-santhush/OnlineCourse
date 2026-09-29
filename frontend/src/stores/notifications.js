import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/lib/api.js';
import { onUserNotifications } from '@/lib/supabase.js';
import { useUiStore } from './ui.js';

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref([]);
  const total = ref(0);
  const unread = ref(0);
  const loading = ref(false);
  let unsubscribe = null;

  const latest = computed(() => items.value.slice(0, 8));

  async function fetchList() {
    loading.value = true;
    try {
      const res = await api.get('/notifications');
      items.value = res.notifications || [];
      total.value = res.total || 0;
      unread.value = res.unread || 0;
    } catch { /* silent — bell just stays empty */ }
    finally { loading.value = false; }
  }

  async function markRead(id) {
    const n = items.value.find((x) => x.id === id);
    if (n && !n.read) { n.read = true; unread.value = Math.max(0, unread.value - 1); }
    try { await api.post(`/notifications/${id}/read`); } catch { /* optimistic */ }
  }
  async function markAllRead() {
    items.value.forEach((n) => (n.read = true));
    unread.value = 0;
    try { await api.post('/notifications/read-all'); } catch { /* noop */ }
  }
  async function remove(id) {
    items.value = items.value.filter((n) => n.id !== id);
    try { await api.delete(`/notifications/${id}`); } catch { /* noop */ }
  }

  /** Start Supabase Realtime so new notifications push into the bell + a toast. */
  function startRealtime(userId) {
    stopRealtime();
    const ui = useUiStore();
    unsubscribe = onUserNotifications(userId, (row) => {
      items.value = [row, ...items.value];
      if (!row.read) unread.value += 1;
      ui.toast.info(row.title, { title: 'New notification' });
    });
  }
  function stopRealtime() { if (unsubscribe) { unsubscribe(); unsubscribe = null; } }

  function reset() { items.value = []; unread.value = 0; total.value = 0; stopRealtime(); }

  return { items, total, unread, loading, latest, fetchList, markRead, markAllRead, remove, startRealtime, stopRealtime, reset };
});
