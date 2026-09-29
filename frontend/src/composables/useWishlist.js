import { ref, computed } from 'vue';
import { api } from '@/lib/api.js';
import { useAuthStore } from '@/stores/auth.js';
import { useUiStore } from '@/stores/ui.js';

// Module-level shared state so every CourseCard reflects the same wishlist.
const ids = ref(new Set()); // set of course ids in wishlist
const courses = ref([]);    // full saved-course objects (for the wishlist view)
const loaded = ref(false);

/** Shared wishlist add/remove with optimistic state. */
export function useWishlist() {
  const auth = useAuthStore();
  const ui = useUiStore();

  async function load(force = false) {
    if (!auth.isAuthed) return;
    if (loaded.value && !force) return;
    try {
      const res = await api.get('/wishlist');
      const list = res.wishlist || res.items || [];
      courses.value = list;
      ids.value = new Set(list.map((w) => w.course_id || w.id));
      loaded.value = true;
    } catch { /* noop */ }
  }
  const has = (id) => ids.value.has(id);
  const count = computed(() => ids.value.size);

  async function toggle(course) {
    if (!auth.isAuthed) return ui.toast.info('Sign in to save courses');
    const id = course.id;
    const next = !ids.value.has(id);
    // optimistic
    next ? ids.value.add(id) : ids.value.delete(id);
    ids.value = new Set(ids.value);
    try {
      await api.post(`/wishlist/${id}`);
      ui.toast.success(next ? 'Added to wishlist' : 'Removed from wishlist');
    } catch (e) {
      next ? ids.value.delete(id) : ids.value.add(id); // revert
      ids.value = new Set(ids.value);
      ui.toast.error(e.message);
    }
  }
  function reset() { ids.value = new Set(); courses.value = []; loaded.value = false; }
  return { ids, courses, count, load, has, toggle, reset };
}
