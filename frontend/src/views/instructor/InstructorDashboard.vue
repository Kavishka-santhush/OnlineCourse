<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import {
  Layers, Users, Wallet, TrendingUp, Plus, BarChart3, ExternalLink, Pencil, ListTree, Loader2,
} from 'lucide-vue-next';
import { Card, Button, Badge, Skeleton } from '@/components/ui';
import StatCard from '@/components/feature/StatCard.vue';
import { api } from '@/lib/api.js';
import { moneyCents, formatDate } from '@/lib/utils.js';
import { useUiStore } from '@/stores/ui.js';

const ui = useUiStore();
const stats = ref(null);
const courses = ref([]);
const loading = ref(true);

const statusVariant = {
  published: 'success', draft: 'muted', submitted: 'outline',
  approved: 'secondary', rejected: 'destructive', unpublished: 'secondary',
};

async function load() {
  loading.value = true;
  try {
    const d = await api.get('/instructors/me/dashboard');
    stats.value = d.stats;
    courses.value = d.courses || [];
  } catch (e) { ui.toast.error(e.message || 'Could not load dashboard'); }
  finally { loading.value = false; }
}
onMounted(load);
</script>

<template>
  <div class="space-y-8">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">Instructor dashboard</h1>
        <p class="mt-1 text-muted-foreground">Your courses, students and earnings at a glance.</p>
      </div>
      <RouterLink :to="{ name: 'course-new' }"><Button><Plus class="h-4 w-4" /> New course</Button></RouterLink>
    </div>

    <!-- stats -->
    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Skeleton v-for="i in 4" :key="i" class="h-28 rounded-xl" /></div>
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Total courses" :value="stats?.totalCourses || 0" :hint="`${stats?.publishedCourses || 0} published`" :icon="Layers" />
      <StatCard label="Students" :value="stats?.totalStudents || 0" :icon="Users" hint="enrolled across courses" />
      <StatCard label="Total earnings" :value="moneyCents(stats?.totalEarnings || 0)" hint="lifetime gross" :icon="Wallet" />
      <StatCard label="Available payout" :value="moneyCents(stats?.pendingPayout || 0)" hint="awaiting withdrawal" :icon="TrendingUp" />
    </div>

    <!-- quick links -->
    <div class="flex flex-wrap gap-3">
      <RouterLink :to="{ name: 'earnings' }"><Button variant="outline" size="sm"><Wallet class="h-4 w-4" /> Earnings & payouts</Button></RouterLink>
      <RouterLink :to="{ name: 'grading' }"><Button variant="outline" size="sm"><BarChart3 class="h-4 w-4" /> Grading queue</Button></RouterLink>
      <RouterLink :to="{ name: 'instructor-analytics' }"><Button variant="outline" size="sm"><TrendingUp class="h-4 w-4" /> Analytics</Button></RouterLink>
    </div>

    <!-- courses -->
    <section>
      <h2 class="mb-4 text-lg font-bold">Your courses</h2>
      <div v-if="loading" class="space-y-3"><Skeleton v-for="i in 3" :key="i" class="h-16 rounded-xl" /></div>
      <Card v-else-if="courses.length" class="divide-y overflow-hidden">
        <div v-for="c in courses" :key="c.id" class="flex flex-wrap items-center gap-3 p-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <RouterLink :to="{ name: 'course-detail', params: { slug: c.slug } }" class="truncate font-semibold hover:text-primary">{{ c.title }}</RouterLink>
              <Badge :variant="statusVariant[c.status] || 'muted'">{{ c.status }}</Badge>
            </div>
            <p class="mt-0.5 text-xs text-muted-foreground">{{ c.enrollment_count || 0 }} students · ★ {{ Number(c.rating_avg || 0).toFixed(1) }} · {{ formatDate(c.created_at) }}</p>
          </div>
          <div class="flex items-center gap-1">
            <RouterLink :to="{ name: 'course-edit', params: { id: c.id } }"><Button variant="ghost" size="sm"><Pencil class="h-4 w-4" /> Edit</Button></RouterLink>
            <RouterLink :to="{ name: 'curriculum', params: { id: c.id } }"><Button variant="ghost" size="sm"><ListTree class="h-4 w-4" /> Curriculum</Button></RouterLink>
            <RouterLink :to="{ name: 'course-detail', params: { slug: c.slug } }" target="_blank"><Button variant="ghost" size="icon"><ExternalLink class="h-4 w-4" /></Button></RouterLink>
          </div>
        </div>
      </Card>
      <Card v-else class="p-10 text-center">
        <Loader2 v-if="loading" class="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        <template v-else>
          <p class="text-muted-foreground">No courses yet. Create your first course to start teaching.</p>
          <RouterLink :to="{ name: 'course-new' }"><Button class="mt-4"><Plus class="h-4 w-4" /> Create course</Button></RouterLink>
        </template>
      </Card>
    </section>
  </div>
</template>
