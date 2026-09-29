<script setup>
import { ref, computed, onMounted } from 'vue';
import { LineChart, Users, CheckCircle2, Star } from 'lucide-vue-next';
import { Card, Badge, Skeleton } from '@/components/ui';
import StatCard from '@/components/feature/StatCard.vue';
import BaseChart from '@/components/feature/BaseChart.vue';
import { api } from '@/lib/api.js';
import { useUiStore } from '@/stores/ui.js';

const ui = useUiStore();
const loading = ref(true);
const courses = ref([]);
const dashStats = ref(null);

const totalStudents = computed(() => courses.value.reduce((a, c) => a + (c.enrollment_count || 0), 0));
const avgCompletion = computed(() => {
  const list = courses.value.filter((c) => c.enrollment_count > 0);
  return list.length ? Math.round(list.reduce((a, c) => a + (c.completion_rate || 0), 0) / list.length) : 0;
});
const avgRating = computed(() => {
  const list = courses.value.filter((c) => c.rating_avg > 0);
  return list.length ? (list.reduce((a, c) => a + Number(c.rating_avg), 0) / list.length).toFixed(2) : '0.00';
});

const enrollChart = computed(() => ({
  labels: courses.value.map((c) => c.title.length > 18 ? c.title.slice(0, 18) + '…' : c.title),
  datasets: [{ label: 'Students', data: courses.value.map((c) => c.enrollment_count || 0) }],
}));
const completionChart = computed(() => ({
  labels: ['Completed', 'In progress'],
  datasets: [{ label: 'Completion', data: [avgCompletion.value, Math.max(0, 100 - avgCompletion.value)] }],
}));

async function load() {
  loading.value = true;
  try {
    const [an, dash] = await Promise.all([
      api.get('/instructors/me/analytics'),
      api.get('/instructors/me/dashboard').catch(() => null),
    ]);
    courses.value = an.courses || [];
    dashStats.value = dash?.stats || null;
  } catch (e) { ui.toast.error(e.message || 'Could not load analytics'); }
  finally { loading.value = false; }
}
onMounted(load);
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="flex items-center gap-2 text-2xl font-bold"><LineChart class="h-6 w-6" /> Analytics</h1>
      <p class="mt-1 text-sm text-muted-foreground">How your courses are performing.</p>
    </div>

    <div v-if="loading" class="space-y-6">
      <div class="grid gap-4 sm:grid-cols-3"><Skeleton v-for="i in 3" :key="i" class="h-28 rounded-xl" /></div>
      <Skeleton class="h-72 rounded-xl" />
    </div>

    <div v-else class="space-y-6">
      <div class="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total students" :value="totalStudents" :icon="Users" hint="all courses" />
        <StatCard label="Avg completion" :value="avgCompletion + '%'" :icon="CheckCircle2" hint="across courses" />
        <StatCard label="Avg rating" :value="avgRating" :icon="Star" hint="out of 5" />
      </div>

      <div class="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card class="p-5">
          <h2 class="mb-3 font-semibold">Enrollment by course</h2>
          <BaseChart v-if="courses.length" type="bar" :data="enrollChart" :height="300" />
          <p v-else class="py-10 text-center text-sm text-muted-foreground">No courses yet.</p>
        </Card>
        <Card class="p-5">
          <h2 class="mb-3 font-semibold">Completion rate</h2>
          <BaseChart type="doughnut" :data="completionChart" :height="300" />
        </Card>
      </div>

      <Card class="overflow-hidden">
        <div class="border-b px-5 py-3.5"><h2 class="font-semibold">Course breakdown</h2></div>
        <table v-if="courses.length" class="w-full text-sm">
          <thead class="bg-muted/40 text-left text-muted-foreground">
            <tr><th class="px-5 py-2 font-medium">Course</th><th class="px-5 py-2 font-medium">Students</th><th class="px-5 py-2 font-medium">Rating</th><th class="px-5 py-2 font-medium">Completion</th></tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="c in courses" :key="c.id">
              <td class="px-5 py-2.5 font-medium">{{ c.title }}</td>
              <td class="px-5 py-2.5">{{ c.enrollment_count || 0 }}</td>
              <td class="px-5 py-2.5"><span v-if="c.rating_avg > 0" class="inline-flex items-center gap-1"><Star class="h-3.5 w-3.5 text-amber-500" /> {{ Number(c.rating_avg).toFixed(1) }}</span><span v-else class="text-muted-foreground">—</span></td>
              <td class="px-5 py-2.5"><Badge :variant="c.completion_rate >= 50 ? 'success' : 'muted'">{{ c.completion_rate || 0 }}%</Badge></td>
            </tr>
          </tbody>
        </table>
        <p v-else class="px-5 py-8 text-center text-sm text-muted-foreground">No data yet.</p>
      </Card>
    </div>
  </div>
</template>
