<script setup>
import { ref, onMounted, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { BookOpen, Flame, Award, Clock, Sparkles, ArrowRight } from 'lucide-vue-next';
import { Card, Button, Progress, Skeleton, Badge } from '@/components/ui';
import StatCard from '@/components/feature/StatCard.vue';
import CourseCard from '@/components/feature/CourseCard.vue';
import { api } from '@/lib/api.js';
import { duration } from '@/lib/utils.js';
import { useAuthStore } from '@/stores/auth.js';

const auth = useAuthStore();
const stats = ref({ stats: { total_seconds: 0, streak_days: 0, courses_completed: 0 }, enrolled: 0 });
const enrollments = ref([]);
const recs = ref([]);
const loading = ref(true);

const continueLearning = computed(() =>
  enrollments.value.filter((e) => e.status !== 'completed').slice(0, 4));

onMounted(async () => {
  try {
    const [ls, en] = await Promise.all([api.get('/learning/stats'), api.get('/enrollments/me')]);
    stats.value = ls;
    enrollments.value = en.enrollments || [];
    try { recs.value = (await api.get('/ai/recommendations')).courses || []; } catch { /* AI optional */ }
  } finally { loading.value = false; }
});
</script>

<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-2xl font-bold">Welcome back, {{ auth.displayName.split(' ')[0] }} 👋</h1>
      <p class="mt-1 text-muted-foreground">Pick up where you left off and keep your streak alive.</p>
    </div>

    <!-- stats -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Enrolled courses" :value="stats.enrolled || 0" :icon="BookOpen" hint="across all categories" />
      <StatCard label="Completed" :value="stats.stats?.courses_completed || 0" :icon="Award" hint="certificates earned" />
      <StatCard label="Day streak" :value="stats.stats?.streak_days || 0" :icon="Flame" hint="keep it going!" />
      <StatCard label="Time learning" :value="duration(stats.stats?.total_seconds || 0)" :icon="Clock" hint="total watch time" />
    </div>

    <!-- continue learning -->
    <section>
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-bold">Continue learning</h2>
        <RouterLink to="/app/learning" class="inline-flex items-center gap-1 text-sm text-primary hover:underline">View all <ArrowRight class="h-4 w-4" /></RouterLink>
      </div>
      <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Skeleton v-for="i in 4" :key="i" class="h-40 rounded-xl" /></div>
      <div v-else-if="continueLearning.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card v-for="e in continueLearning" :key="e.id" class="overflow-hidden">
          <RouterLink :to="{ name: 'player', params: { slug: e.course?.slug } }">
            <div class="aspect-video bg-muted">
              <img v-if="e.course?.thumbnail_url" :src="e.course.thumbnail_url" class="h-full w-full object-cover" />
            </div>
          </RouterLink>
          <div class="p-4">
            <RouterLink :to="{ name: 'player', params: { slug: e.course?.slug } }" class="line-clamp-2 text-sm font-semibold hover:text-primary">{{ e.course?.title }}</RouterLink>
            <Progress :model-value="e.progress_percent || 0" class="mt-3" />
            <div class="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>{{ e.progress_percent || 0 }}% complete</span>
              <span>{{ e.last_lesson?.title ? 'Next: ' + e.last_lesson.title : '' }}</span>
            </div>
          </div>
        </Card>
      </div>
      <Card v-else class="p-8 text-center">
        <p class="text-muted-foreground">You're not enrolled in any courses yet.</p>
        <Button to="/courses" class="mt-4">Browse courses</Button>
      </Card>
    </section>

    <!-- AI recommendations -->
    <section v-if="recs.length">
      <div class="mb-4 flex items-center gap-2">
        <Sparkles class="h-5 w-5 text-primary" />
        <h2 class="text-lg font-bold">Recommended for you</h2>
      </div>
      <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <CourseCard v-for="c in recs.slice(0, 4)" :key="c.id" :course="c" />
      </div>
    </section>
  </div>
</template>
