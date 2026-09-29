<script setup>
import { ref, onMounted } from 'vue';
import { BadgeCheck, Flag, Star, ExternalLink, Check, X } from 'lucide-vue-next';
import { Card, Button, Badge, Tabs, Modal, Textarea, Label, Skeleton } from '@/components/ui';
import EmptyState from '@/components/feature/EmptyState.vue';
import { api } from '@/lib/api.js';
import { moneyCents, formatDate } from '@/lib/utils.js';
import { useUiStore } from '@/stores/ui.js';

const ui = useUiStore();
const tab = ref('courses');

// ── course review queue ──────────────────────────────────
const coursesLoading = ref(true);
const courses = ref([]);
const status = ref('submitted');
const rejecting = ref(null); // course being rejected
const reason = ref('');
const acting = ref(null);

const statusOptions = [
  { value: 'submitted', label: 'In review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

async function loadCourses() {
  coursesLoading.value = true;
  try {
    const d = await api.get(`/courses/moderation/queue?status=${status.value}`);
    courses.value = d.courses || [];
  } catch (e) { ui.toast.error(e.message || 'Could not load queue'); }
  finally { coursesLoading.value = false; }
}
onMounted(loadCourses);

function changeStatus(v) { status.value = v; loadCourses(); }

async function approve(c) {
  acting.value = c.id;
  try { await api.post(`/courses/${c.id}/moderate`, { decision: 'approve' }); ui.toast.success('Course approved'); await loadCourses(); }
  catch (e) { ui.toast.error(e.message || 'Failed'); }
  finally { acting.value = null; }
}

async function confirmReject() {
  if (!reason.value.trim()) return ui.toast.error('A reason is required');
  acting.value = rejecting.value.id;
  try {
    await api.post(`/courses/${rejecting.value.id}/moderate`, { decision: 'reject', reason: reason.value.trim() });
    ui.toast.success('Course rejected');
    rejecting.value = null; reason.value = '';
    await loadCourses();
  } catch (e) { ui.toast.error(e.message || 'Failed'); }
  finally { acting.value = null; }
}

async function toggleFeature(c) {
  acting.value = c.id;
  try { await api.patch(`/courses/${c.id}/feature`, { is_featured: !c.is_featured }); c.is_featured = !c.is_featured; ui.toast.success(c.is_featured ? 'Featured' : 'Unfeatured'); }
  catch (e) { ui.toast.error(e.message || 'Failed'); }
  finally { acting.value = null; }
}

// ── flags ────────────────────────────────────────────────
const flagsLoading = ref(false);
const flags = ref([]);

async function loadFlags() {
  flagsLoading.value = true;
  try { const d = await api.get('/admin/flags?status=open'); flags.value = d.flags || []; }
  catch (e) { ui.toast.error(e.message || 'Could not load flags'); }
  finally { flagsLoading.value = false; }
}

function onTab(v) { tab.value = v; if (v === 'flags' && !flags.value.length) loadFlags(); }

async function resolveFlag(f, action) {
  acting.value = f.id;
  try { await api.post(`/admin/flags/${f.id}/resolve`, { action }); ui.toast.success('Flag resolved'); flags.value = flags.value.filter((x) => x.id !== f.id); }
  catch (e) { ui.toast.error(e.message || 'Failed'); }
  finally { acting.value = null; }
}
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="flex items-center gap-2 text-2xl font-bold"><BadgeCheck class="h-6 w-6" /> Moderation</h1>
      <p class="mt-1 text-sm text-muted-foreground">Review submitted courses and handle reported content.</p>
    </div>

    <Tabs :model-value="tab" :tabs="[{ value: 'courses', label: 'Course queue' }, { value: 'flags', label: 'Reported content' }]" class="mb-5" @update:model-value="onTab" />

    <!-- Course queue -->
    <div v-if="tab === 'courses'">
      <div class="mb-4 flex items-center gap-2">
        <span class="text-sm text-muted-foreground">Show:</span>
        <Button v-for="o in statusOptions" :key="o.value" :variant="status === o.value ? 'default' : 'outline'" size="sm" @click="changeStatus(o.value)">{{ o.label }}</Button>
      </div>

      <div v-if="coursesLoading" class="space-y-3"><Skeleton v-for="i in 4" :key="i" class="h-28 rounded-xl" /></div>

      <div v-else-if="courses.length" class="space-y-3">
        <Card v-for="c in courses" :key="c.id" class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <img v-if="c.thumbnail_url" :src="c.thumbnail_url" alt="" class="h-24 w-full rounded-lg object-cover sm:w-40" />
          <div v-else class="grid h-24 w-full place-items-center rounded-lg bg-muted text-muted-foreground sm:w-40"><ExternalLink class="h-6 w-6" /></div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-semibold">{{ c.title }}</h3>
              <Badge v-if="c.is_free" variant="success">Free</Badge>
              <Badge v-else variant="muted">{{ moneyCents(c.price * 100) }}</Badge>
              <Badge v-if="c.is_featured" variant="secondary"><Star class="mr-1 h-3 w-3" /> Featured</Badge>
            </div>
            <p class="mt-0.5 text-xs text-muted-foreground">{{ c.instructor?.display_name }} · {{ c.category?.name || 'Uncategorised' }} · {{ c.level }}</p>
          </div>
          <div class="flex shrink-0 flex-wrap gap-2">
            <Button :loading="acting === c.id" size="sm" @click="approve(c)"><Check class="h-4 w-4" /> Approve</Button>
            <Button variant="outline" size="sm" :disabled="acting === c.id" @click="rejecting = c; reason = ''"><X class="h-4 w-4" /> Reject</Button>
            <Button v-if="c.status === 'approved'" variant="ghost" size="sm" :disabled="acting === c.id" @click="toggleFeature(c)"><Star class="h-4 w-4" /> {{ c.is_featured ? 'Unfeature' : 'Feature' }}</Button>
          </div>
        </Card>
      </div>
      <EmptyState v-else :icon="BadgeCheck" title="Queue is empty" description="No courses awaiting review." />
    </div>

    <!-- Flags -->
    <div v-else>
      <div v-if="flagsLoading" class="space-y-3"><Skeleton v-for="i in 4" :key="i" class="h-20 rounded-xl" /></div>
      <div v-else-if="flags.length" class="space-y-3">
        <Card v-for="f in flags" :key="f.id" class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <Badge variant="destructive">{{ f.entity_type }}</Badge>
              <span class="text-sm font-medium">{{ f.reason || 'No reason given' }}</span>
            </div>
            <p class="mt-0.5 text-xs text-muted-foreground">Reported by {{ f.reporter?.display_name || 'unknown' }} · {{ formatDate(f.created_at) }}</p>
          </div>
          <div class="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" :disabled="acting === f.id" @click="resolveFlag(f, 'dismiss')">Dismiss</Button>
            <Button variant="outline" size="sm" :disabled="acting === f.id" @click="resolveFlag(f, 'warn_user')">Warn user</Button>
            <Button variant="destructive" size="sm" :disabled="acting === f.id" @click="resolveFlag(f, 'remove_content')">Remove</Button>
          </div>
        </Card>
      </div>
      <EmptyState v-else :icon="Flag" title="No open reports" description="Nothing needs your attention right now." />
    </div>

    <!-- Reject modal -->
    <Modal v-model:open="rejecting" title="Reject course">
      <div>
        <Label class="mb-1.5 block">Reason (shared with the instructor)</Label>
        <Textarea v-model="reason" rows="4" placeholder="Explain what needs to change…" />
      </div>
      <template #footer>
        <Button variant="outline" @click="rejecting = null">Cancel</Button>
        <Button variant="destructive" :loading="!!acting" @click="confirmReject">Reject course</Button>
      </template>
    </Modal>
  </div>
</template>
