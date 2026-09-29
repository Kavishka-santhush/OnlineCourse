<script setup>
import { ref, computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { Search, BookOpen } from 'lucide-vue-next';
import { Card, Button, Input, Progress, Tabs, Badge, Skeleton } from '@/components/ui';
import EmptyState from '@/components/feature/EmptyState.vue';
import { api } from '@/lib/api.js';
import { duration } from '@/lib/utils.js';

const enrollments = ref([]);
const loading = ref(true);
const q = ref('');
const filter = ref('all');

const filtered = computed(() => {
  let list = enrollments.value;
  if (filter.value === 'progress') list = list.filter((e) => e.status === 'active');
  if (filter.value === 'completed') list = list.filter((e) => e.status === 'completed');
  if (q.value) { const t = q.value.toLowerCase(); list = list.filter((e) => (e.course?.title || '').toLowerCase().includes(t)); }
  return list;
});

onMounted(async () => {
  try { enrollments.value = (await api.get('/enrollments/me')).enrollments || []; }
  finally { loading.value = false; }
});
</script>

<template>
  <div>
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold">My learning</h1>
        <p class="mt-1 text-sm text-muted-foreground">{{ enrollments.length }} enrolled courses</p>
      </div>
      <RouterLink to="/courses"><Button variant="outline">+ Add courses</Button></RouterLink>
    </div>

    <div class="mb-6 flex flex-wrap items-center gap-3">
      <Tabs v-model="filter" :tabs="[
        { value: 'all', label: 'All' },
        { value: 'progress', label: 'In progress' },
        { value: 'completed', label: 'Completed' },
      ]" />
      <div class="relative ml-auto w-full max-w-xs">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="q" placeholder="Search my courses" class="pl-9" />
      </div>
    </div>

    <div v-if="loading" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Skeleton v-for="i in 6" :key="i" class="h-44 rounded-xl" />
    </div>

    <div v-else-if="filtered.length" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card v-for="e in filtered" :key="e.id" class="overflow-hidden">
        <RouterLink :to="{ name: 'player', params: { slug: e.course?.slug } }" class="block">
          <div class="relative aspect-video bg-muted">
            <img v-if="e.course?.thumbnail_url" :src="e.course.thumbnail_url" class="h-full w-full object-cover" />
            <Badge v-if="e.status === 'completed'" variant="success" class="absolute right-2 top-2">Completed</Badge>
          </div>
        </RouterLink>
        <div class="p-4">
          <RouterLink :to="{ name: 'player', params: { slug: e.course?.slug } }" class="line-clamp-2 font-semibold hover:text-primary">{{ e.course?.title }}</RouterLink>
          <div class="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{{ e.course?.level }}</span><span>·</span><span>{{ duration(e.course?.total_duration_seconds) }}</span>
          </div>
          <Progress :model-value="e.progress_percent || 0" class="mt-3" />
          <div class="mt-3 flex items-center justify-between">
            <span class="text-xs font-medium">{{ e.progress_percent || 0 }}%</span>
            <RouterLink :to="{ name: 'player', params: { slug: e.course?.slug } }">
              <Button size="sm">{{ e.status === 'completed' ? 'Review' : 'Continue' }}</Button>
            </RouterLink>
          </div>
        </div>
      </Card>
    </div>

    <EmptyState v-else :icon="BookOpen" title="No courses here" description="Enroll in courses to see them here.">
      <RouterLink to="/courses"><Button>Browse the catalog</Button></RouterLink>
    </EmptyState>
  </div>
</template>
