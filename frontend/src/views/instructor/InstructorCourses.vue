<script setup>
import { ref, computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import {
  Plus, Pencil, ListTree, ExternalLink, Send, Upload, Download, Copy, Trash2, Search,
} from 'lucide-vue-next';
import { Card, Button, Badge, Input, Tabs, Modal, Skeleton } from '@/components/ui';
import EmptyState from '@/components/feature/EmptyState.vue';
import { api } from '@/lib/api.js';
import { money } from '@/lib/utils.js';
import { useUiStore } from '@/stores/ui.js';

const ui = useUiStore();
const courses = ref([]);
const loading = ref(true);
const q = ref('');
const tab = ref('all');
const busyId = ref(null);
const showDelete = ref(false);
const confirmDelete = ref(null); // course

const statusVariant = {
  published: 'success', draft: 'muted', submitted: 'outline',
  approved: 'secondary', rejected: 'destructive', unpublished: 'secondary',
};

const filtered = computed(() => {
  let list = courses.value;
  if (tab.value !== 'all') list = list.filter((c) => c.status === tab.value);
  if (q.value) { const t = q.value.toLowerCase(); list = list.filter((c) => c.title.toLowerCase().includes(t)); }
  return list;
});

async function load() {
  loading.value = true;
  try { courses.value = (await api.get('/courses/instructor/mine')).courses || []; }
  catch (e) { ui.toast.error(e.message || 'Could not load courses'); }
  finally { loading.value = false; }
}

async function act(c, fn) {
  busyId.value = c.id;
  try { await fn(); await load(); }
  catch (e) { ui.toast.error(e.message || 'Action failed'); }
  finally { busyId.value = null; }
}

const submit = (c) => act(c, () => api.post(`/courses/${c.id}/submit`).then(() => ui.toast.success('Sent for review')));
const publish = (c) => act(c, () => api.post(`/courses/${c.id}/publish`).then(() => ui.toast.success('Published 🎉')));
const unpublish = (c) => act(c, () => api.post(`/courses/${c.id}/publish`, { unpublish: true }).then(() => ui.toast.info('Course unpublished')));
const clone = (c) => act(c, () => api.post(`/courses/${c.id}/clone`).then(() => ui.toast.success('Duplicated as draft')));
async function doDelete() {
  const c = confirmDelete.value;
  busyId.value = c.id;
  try { await api.delete(`/courses/${c.id}`); ui.toast.success('Course deleted'); showDelete.value = false; confirmDelete.value = null; await load(); }
  catch (e) { ui.toast.error(e.message || 'Delete failed'); }
  finally { busyId.value = null; }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">My courses</h1>
        <p class="mt-1 text-sm text-muted-foreground">{{ courses.length }} total</p>
      </div>
      <RouterLink :to="{ name: 'course-new' }"><Button><Plus class="h-4 w-4" /> New course</Button></RouterLink>
    </div>

    <div class="mb-5 flex flex-wrap items-center gap-3">
      <Tabs v-model="tab" :tabs="[
        { value: 'all', label: 'All' }, { value: 'draft', label: 'Drafts' },
        { value: 'submitted', label: 'In review' }, { value: 'published', label: 'Published' },
        { value: 'rejected', label: 'Rejected' },
      ]" />
      <div class="relative ml-auto w-full max-w-xs">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="q" placeholder="Search courses" class="pl-9" />
      </div>
    </div>

    <div v-if="loading" class="space-y-3"><Skeleton v-for="i in 4" :key="i" class="h-20 rounded-xl" /></div>

    <div v-else-if="filtered.length" class="space-y-3">
      <Card v-for="c in filtered" :key="c.id" class="flex flex-wrap items-center gap-4 p-4">
        <div class="h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-muted">
          <img v-if="c.thumbnail_url" :src="c.thumbnail_url" class="h-full w-full object-cover" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="truncate font-semibold">{{ c.title }}</span>
            <Badge :variant="statusVariant[c.status] || 'muted'">{{ c.status }}</Badge>
            <Badge v-if="c.is_free" variant="success">Free</Badge>
          </div>
          <p class="mt-0.5 text-xs text-muted-foreground">
            {{ c.level }} · {{ c.enrollment_count || 0 }} students · ★ {{ Number(c.rating_avg || 0).toFixed(1) }}
            <span v-if="!c.is_free"> · {{ money(c.price, c.currency) }}</span>
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-1">
          <RouterLink :to="{ name: 'course-edit', params: { id: c.id } }"><Button variant="ghost" size="icon" title="Edit"><Pencil class="h-4 w-4" /></Button></RouterLink>
          <RouterLink :to="{ name: 'curriculum', params: { id: c.id } }"><Button variant="ghost" size="icon" title="Curriculum"><ListTree class="h-4 w-4" /></Button></RouterLink>
          <RouterLink :to="{ name: 'course-detail', params: { slug: c.slug } }" target="_blank"><Button variant="ghost" size="icon" title="View"><ExternalLink class="h-4 w-4" /></Button></RouterLink>

          <Button v-if="['draft','rejected'].includes(c.status)" size="sm" variant="outline" :disabled="busyId === c.id" @click="submit(c)"><Send class="h-4 w-4" /> Submit</Button>
          <Button v-if="c.status === 'approved'" size="sm" :disabled="busyId === c.id" @click="publish(c)"><Upload class="h-4 w-4" /> Publish</Button>
          <Button v-if="c.status === 'published'" size="sm" variant="outline" :disabled="busyId === c.id" @click="unpublish(c)"><Download class="h-4 w-4" /> Unpublish</Button>
          <Button size="sm" variant="ghost" :disabled="busyId === c.id" @click="clone(c)"><Copy class="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" @click="confirmDelete = c; showDelete = true"><Trash2 class="h-4 w-4 text-destructive" /></Button>
        </div>
      </Card>
    </div>

    <EmptyState v-else :icon="ListTree" title="No courses in this view" description="Create a course or change the filter." />

    <Modal v-model:open="showDelete" title="Delete course?">
      <p class="text-sm">This permanently deletes <span class="font-semibold">{{ confirmDelete?.title }}</span> and its curriculum. This cannot be undone.</p>
      <template #footer>
        <Button variant="outline" @click="showDelete = false">Cancel</Button>
        <Button variant="destructive" :loading="!!busyId && busyId === confirmDelete?.id" @click="doDelete"><Trash2 class="h-4 w-4" /> Delete</Button>
      </template>
    </Modal>
  </div>
</template>
