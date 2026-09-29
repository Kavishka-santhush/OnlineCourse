<script setup>
import { ref, reactive, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { SlidersHorizontal, X, Search } from 'lucide-vue-next';
import { Button, Input, Select, Skeleton, Badge } from '@/components/ui';
import CourseCard from '@/components/feature/CourseCard.vue';
import EmptyState from '@/components/feature/EmptyState.vue';
import { api } from '@/lib/api.js';

const route = useRoute();
const router = useRouter();

const levels = ['Beginner', 'Intermediate', 'Advanced', 'All Levels'];
const sortOptions = [
  { value: 'popular', label: 'Most popular' },
  { value: 'rating', label: 'Top rated' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_low', label: 'Price: low to high' },
  { value: 'price_high', label: 'Price: high to low' },
];

const filters = reactive({
  q: route.query.q || '',
  category: route.query.category || '',
  level: route.query.level || '',
  language: route.query.language || '',
  free: route.query.free === 'true',
  sort: route.query.sort || 'popular',
});

const categories = ref([]);
const courses = ref([]);
const total = ref(0);
const pages = ref(1);
const page = ref(Number(route.query.page) || 1);
const loading = ref(true);
const showFilters = ref(false);

function buildQuery() {
  const p = {};
  if (filters.q) p.q = filters.q;
  if (filters.category) p.category = filters.category;
  if (filters.level) p.level = filters.level;
  if (filters.language) p.language = filters.language;
  if (filters.free) p.free = 'true';
  if (filters.sort) p.sort = filters.sort;
  if (page.value > 1) p.page = page.value;
  return p;
}

async function load() {
  loading.value = true;
  try {
    const res = await api.get('/courses', { params: { ...buildQuery(), limit: 24 } });
    courses.value = res.courses || [];
    total.value = res.total || 0;
    pages.value = res.pages || 1;
  } catch (e) {
    courses.value = [];
  } finally {
    loading.value = false;
  }
}

function apply(resetPage = true) {
  if (resetPage) page.value = 1;
  router.push({ name: 'catalog', query: buildQuery() });
  load();
}

function gotoPage(n) {
  page.value = n;
  apply(false);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearAll() {
  Object.assign(filters, { q: '', category: '', level: '', language: '', free: false, sort: 'popular' });
  apply();
}

const activeCount = () => [filters.q, filters.category, filters.level, filters.language].filter(Boolean).length + (filters.free ? 1 : 0);

onMounted(async () => {
  try { const r = await api.get('/categories'); categories.value = r.categories || []; } catch { /* noop */ }
  load();
});

// Keep in sync if the URL changes externally (e.g. navbar search).
watch(() => route.query, (q) => {
  filters.q = q.q || '';
  filters.category = q.category || '';
  if (!q.page) page.value = 1;
  load();
});
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-6">
      <h1 class="text-2xl font-bold">All courses</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        <span v-if="!loading">{{ total }} course{{ total === 1 ? '' : 's' }} found</span>
        <span v-else>Loading…</span>
      </p>
    </div>

    <div class="lg:grid lg:grid-cols-[240px_1fr] lg:gap-8">
      <!-- filter sidebar (desktop) -->
      <aside class="hidden lg:block">
        <div class="sticky top-20 space-y-6 rounded-xl border bg-card p-5">
          <div class="flex items-center justify-between">
            <h2 class="flex items-center gap-2 font-semibold"><SlidersHorizontal class="h-4 w-4" /> Filters</h2>
            <button v-if="activeCount()" class="text-xs text-primary hover:underline" @click="clearAll">Clear</button>
          </div>

          <div class="relative">
            <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input v-model="filters.q" placeholder="Search…" class="pl-9" @keyup.enter="apply()" />
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium">Category</label>
            <Select v-model="filters.category" placeholder="All categories" :options="categories.map(c => ({ value: c.id, label: c.name }))" @update:model-value="apply()" />
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium">Level</label>
            <Select v-model="filters.level" placeholder="Any level" :options="levels.map(l => ({ value: l, label: l }))" @update:model-value="apply()" />
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium">Price</label>
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" v-model="filters.free" @change="apply()" class="h-4 w-4 rounded border-input" />
              Free courses only
            </label>
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium">Sort by</label>
            <Select v-model="filters.sort" :options="sortOptions" @update:model-value="apply()" />
          </div>
        </div>
      </aside>

      <!-- results -->
      <div>
        <!-- mobile filter toggle -->
        <div class="mb-4 flex items-center gap-2 lg:hidden">
          <Button variant="outline" size="sm" @click="showFilters = true">
            <SlidersHorizontal class="h-4 w-4" /> Filters
            <Badge v-if="activeCount()" variant="default" class="ml-1">{{ activeCount() }}</Badge>
          </Button>
          <Select v-model="filters.sort" class="max-w-[180px]" :options="sortOptions" @update:model-value="apply()" />
        </div>

        <div v-if="loading" class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton v-for="i in 6" :key="i" class="h-72 rounded-xl" />
        </div>

        <div v-else-if="courses.length" class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <CourseCard v-for="c in courses" :key="c.id" :course="c" />
        </div>

        <EmptyState v-else :icon="Search" title="No courses match your filters"
          description="Try removing some filters or searching for a different topic.">
          <Button @click="clearAll">Clear filters</Button>
        </EmptyState>

        <!-- pagination -->
        <div v-if="pages > 1" class="mt-8 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" :disabled="page <= 1" @click="gotoPage(page - 1)">Previous</Button>
          <span class="text-sm text-muted-foreground">Page {{ page }} of {{ pages }}</span>
          <Button variant="outline" size="sm" :disabled="page >= pages" @click="gotoPage(page + 1)">Next</Button>
        </div>
      </div>
    </div>

    <!-- mobile filter drawer -->
    <Transition enter-active-class="transition" enter-from-class="opacity-0" leave-active-class="transition" leave-to-class="opacity-0">
      <div v-if="showFilters" class="fixed inset-0 z-50 lg:hidden">
        <div class="absolute inset-0 bg-black/50" @click="showFilters = false" />
        <div class="absolute inset-y-0 left-0 w-80 max-w-[85%] overflow-y-auto bg-background p-5 shadow-xl">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="font-semibold">Filters</h2>
            <button @click="showFilters = false" class="rounded p-1 hover:bg-accent"><X class="h-5 w-5" /></button>
          </div>
          <div class="space-y-5">
            <div><Input v-model="filters.q" placeholder="Search…" @keyup.enter="showFilters = false; apply()" /></div>
            <div><label class="mb-1.5 block text-sm font-medium">Category</label>
              <Select v-model="filters.category" placeholder="All categories" :options="categories.map(c => ({ value: c.id, label: c.name }))" /></div>
            <div><label class="mb-1.5 block text-sm font-medium">Level</label>
              <Select v-model="filters.level" placeholder="Any level" :options="levels.map(l => ({ value: l, label: l }))" /></div>
            <label class="flex items-center gap-2 text-sm"><input type="checkbox" v-model="filters.free" class="h-4 w-4" /> Free only</label>
            <Button class="w-full" @click="showFilters = false; apply()">Apply filters</Button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
