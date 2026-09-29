<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Shield, Users, GraduationCap, Student, BookOpen, BadgeCheck, Wallet, Percent, ArrowRight } from 'lucide-vue-next';
import { Card, Skeleton } from '@/components/ui';
import StatCard from '@/components/feature/StatCard.vue';
import BaseChart from '@/components/feature/BaseChart.vue';
import { api } from '@/lib/api.js';
import { moneyCents, compact } from '@/lib/utils.js';
import { useUiStore } from '@/stores/ui.js';

const router = useRouter();
const ui = useUiStore();
const loading = ref(true);
const stats = ref(null);
const series = ref([]);

const chartData = computed(() => ({
  labels: series.value.map((s) => s.month),
  datasets: [{ label: 'Revenue', data: series.value.map((s) => Math.round(s.cents / 100)) }],
}));

const queue = [
  { label: 'Moderation queue', to: '/dashboard/admin/moderation', icon: BadgeCheck },
  { label: 'Manage users', to: '/dashboard/admin/users', icon: Users },
  { label: 'Instructor applications', to: '/dashboard/admin/instructors', icon: GraduationCap },
  { label: 'Refunds & payouts', to: '/dashboard/admin/commerce', icon: Wallet },
];

async function load() {
  loading.value = true;
  try {
    const d = await api.get('/admin/dashboard');
    stats.value = d.stats;
    series.value = d.revenueSeries || [];
  } catch (e) { ui.toast.error(e.message || 'Could not load dashboard'); }
  finally { loading.value = false; }
}
onMounted(load);
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="flex items-center gap-2 text-2xl font-bold"><Shield class="h-6 w-6" /> Admin overview</h1>
      <p class="mt-1 text-sm text-muted-foreground">Platform health, revenue and moderation at a glance.</p>
    </div>

    <div v-if="loading" class="space-y-6">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Skeleton v-for="i in 8" :key="i" class="h-28 rounded-xl" /></div>
      <Skeleton class="h-72 rounded-xl" />
    </div>

    <div v-else class="space-y-6">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Users" :value="compact(stats.users)" :icon="Users" hint="all roles" />
        <StatCard label="Instructors" :value="compact(stats.instructors)" :icon="GraduationCap" :hint="`${stats.students} students`" />
        <StatCard label="Courses" :value="compact(stats.courses)" :icon="BookOpen" :hint="`${stats.published} published`" />
        <StatCard label="Enrollments" :value="compact(stats.enrollments)" :icon="Student" hint="total" />
        <StatCard label="Gross revenue" :value="moneyCents(stats.revenue_cents)" :icon="Wallet" hint="paid orders" />
        <StatCard label="Commission" :value="moneyCents(stats.commission_cents)" :icon="Percent" hint="platform earnings" />
        <StatCard label="Instructor payouts" :value="moneyCents(stats.instructor_payouts_cents)" :icon="Wallet" hint="owed/paid out" />
        <StatCard label="Published rate" :value="stats.courses ? Math.round((stats.published / stats.courses) * 100) + '%' : '—'" :icon="BadgeCheck" hint="of all courses" />
      </div>

      <Card class="p-5">
        <h2 class="mb-3 font-semibold">Revenue by month</h2>
        <BaseChart v-if="series.length" type="line" :data="chartData" :height="300" />
        <p v-else class="py-12 text-center text-sm text-muted-foreground">No revenue recorded yet.</p>
      </Card>

      <div class="grid gap-4 sm:grid-cols-2">
        <button v-for="q in queue" :key="q.to" class="flex items-center justify-between rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/50" @click="router.push(q.to)">
          <span class="flex items-center gap-3"><component :is="q.icon" class="h-5 w-5 text-primary" /><span class="font-medium">{{ q.label }}</span></span>
          <ArrowRight class="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  </div>
</template>
