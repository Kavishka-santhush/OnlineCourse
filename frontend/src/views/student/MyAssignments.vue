<script setup>
import { ref, computed, onMounted } from 'vue';
import { ClipboardList, Calendar } from 'lucide-vue-next';
import { Card, Badge, Tabs, Skeleton } from '@/components/ui';
import EmptyState from '@/components/feature/EmptyState.vue';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';

const items = ref([]);
const loading = ref(true);
const tab = ref('all');

const statusVariant = {
  submitted: 'muted', graded: 'success', resubmit_requested: 'destructive',
  pending: 'outline', not_submitted: 'secondary',
};

const filtered = computed(() => {
  if (tab.value === 'pending') return items.value.filter((a) => !a.my_submission);
  if (tab.value === 'graded') return items.value.filter((a) => a.my_submission?.status === 'graded');
  return items.value;
});

function isOverdue(a) {
  return a.due_date && !a.my_submission && new Date(a.due_date) < new Date();
}

onMounted(async () => {
  try { items.value = (await api.get('/assignments/me')).assignments || []; }
  finally { loading.value = false; }
});
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="flex items-center gap-2 text-2xl font-bold"><ClipboardList class="h-6 w-6" /> My assignments</h1>
      <p class="mt-1 text-sm text-muted-foreground">Submissions and grades across your enrolled courses.</p>
    </div>

    <div class="mb-5">
      <Tabs v-model="tab" :tabs="[
        { value: 'all', label: 'All' },
        { value: 'pending', label: 'To do' },
        { value: 'graded', label: 'Graded' },
      ]" />
    </div>

    <div v-if="loading" class="space-y-3">
      <Skeleton v-for="i in 4" :key="i" class="h-24 rounded-xl" />
    </div>

    <div v-else-if="filtered.length" class="space-y-3">
      <Card v-for="a in filtered" :key="a.id" class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <p class="font-semibold leading-tight">{{ a.title }}</p>
          <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span v-if="a.due_date" class="inline-flex items-center gap-1"><Calendar class="h-3.5 w-3.5" /> Due {{ formatDate(a.due_date) }}</span>
            <span>{{ a.max_points }} pts</span>
            <Badge v-if="a.peer_review" variant="outline">Peer review</Badge>
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-3">
          <template v-if="a.my_submission">
            <Badge :variant="statusVariant[a.my_submission.status] || 'muted'">{{ a.my_submission.status.replace('_', ' ') }}</Badge>
            <span v-if="a.my_submission.status === 'graded' && a.my_submission.score != null" class="text-sm font-semibold">
              {{ a.my_submission.score }}/{{ a.max_points }}
            </span>
          </template>
          <Badge v-else :variant="isOverdue(a) ? 'destructive' : 'secondary'">{{ isOverdue(a) ? 'Overdue' : 'Not submitted' }}</Badge>
          <RouterLink v-if="a.lesson_id" :to="{ name: 'my-learning' }" class="text-sm font-medium text-primary hover:underline">Open</RouterLink>
        </div>
      </Card>
    </div>

    <EmptyState v-else :icon="ClipboardList" title="No assignments"
      description="Assignments from your courses will show up here." />
  </div>
</template>
