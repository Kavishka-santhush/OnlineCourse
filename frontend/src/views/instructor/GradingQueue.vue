<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { Check, Sparkles, Inbox, Loader2, ExternalLink } from 'lucide-vue-next';
import { Card, Button, Input, Label, Badge, Tabs, Select } from '@/components/ui';
import EmptyState from '@/components/feature/EmptyState.vue';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';
import { useUiStore } from '@/stores/ui.js';

const ui = useUiStore();
const loading = ref(true);
const courses = ref([]);
const courseId = ref('all');
const queue = ref([]); // flattened pending submissions

const graded = reactive({}); // submissionId -> { status, score }

const filtered = computed(() =>
  courseId.value === 'all' ? queue.value : queue.value.filter((s) => s.course_id === courseId.value));

const courseOptions = computed(() => [
  { value: 'all', label: 'All my courses' },
  ...courses.value.map((c) => ({ value: c.id, label: c.title })),
]);

async function load() {
  loading.value = true;
  queue.value = [];
  try {
    courses.value = (await api.get('/courses/instructor/mine')).courses || [];
    for (const c of courses.value) {
      const { assignments = [] } = await api.get(`/assignments/course/${c.id}`).catch(() => ({ assignments: [] }));
      for (const a of assignments) {
        const { submissions = [] } = await api.get(`/assignments/${a.id}/submissions`).catch(() => ({ submissions: [] }));
        for (const s of submissions) {
          if (s.status === 'graded') continue;
          queue.value.push({ ...s, course_id: c.id, course_title: c.title, assignment_id: a.id, assignment_title: a.title, max_points: a.max_points ?? 100 });
        }
      }
    }
    queue.value.sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
    for (const s of queue.value) graded[s.id] = { score: '', feedback: '' };
  } catch (e) { ui.toast.error(e.message || 'Could not load queue'); }
  finally { loading.value = false; }
}

const saving = ref(null);
const aiBusy = ref(null);

async function grade(s) {
  const g = graded[s.id] || {};
  if (g.score === '' || g.score == null) return ui.toast.error('Enter a score');
  saving.value = s.id;
  try {
    const { submission } = await api.post(`/submissions/${s.id}/grade`, { score: Number(g.score), feedback: g.feedback || '' });
    ui.toast.success(`Graded ${s.student?.display_name}`);
    queue.value = queue.value.filter((x) => x.id !== s.id);
  } catch (e) { ui.toast.error(e.message || 'Could not grade'); }
  finally { saving.value = null; }
}

async function requestResubmit(s) {
  const g = graded[s.id] || {};
  try {
    await api.post(`/submissions/${s.id}/request-resubmit`, { feedback: g.feedback || 'Please revise your submission.' });
    ui.toast.info('Resubmission requested');
    queue.value = queue.value.filter((x) => x.id !== s.id);
  } catch (e) { ui.toast.error(e.message); }
}

async function aiAssist(s) {
  aiBusy.value = s.id;
  try {
    const { feedback } = await api.post('/assignments/feedback-assistant', { submission_text: s.text_submission, assignment_title: s.assignment_title });
    graded[s.id].feedback = feedback;
  } catch (e) { ui.toast.error(e.message || 'AI unavailable'); }
  finally { aiBusy.value = null; }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="flex items-center gap-2 text-2xl font-bold"><Inbox class="h-6 w-6" /> Grading queue</h1>
        <p class="mt-1 text-sm text-muted-foreground">{{ queue.length }} submissions awaiting review.</p>
      </div>
      <Select v-model="courseId" :options="courseOptions" class="w-64" />
    </div>

    <div v-if="loading" class="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 class="h-5 w-5 animate-spin" /> Scanning your courses…</div>

    <div v-else-if="filtered.length" class="space-y-4">
      <Card v-for="s in filtered" :key="s.id" class="p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="font-semibold">{{ s.student?.display_name }} <span class="text-sm font-normal text-muted-foreground">· {{ s.student?.email }}</span></p>
            <p class="text-sm text-muted-foreground">{{ s.assignment_title }} — {{ s.course_title }}</p>
            <p class="mt-0.5 text-xs text-muted-foreground">{{ s.submitted_at ? formatDate(s.submitted_at, 'DD MMM YYYY HH:mm') : '' }} <Badge v-if="s.status === 'late'" variant="destructive" class="ml-1">Late</Badge></p>
          </div>
        </div>

        <div v-if="s.text_submission" class="mt-3 whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">{{ s.text_submission }}</div>
        <div v-if="s.files?.length" class="mt-2 flex flex-wrap gap-2">
          <a v-for="(f, i) in s.files" :key="i" :href="f.url" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ExternalLink class="h-3.5 w-3.5" /> {{ f.name }}</a>
        </div>

        <div class="mt-4 flex flex-wrap items-end gap-2 border-t pt-4">
          <div class="w-28">
            <Label class="mb-1 block text-xs">Score / {{ s.max_points }}</Label>
            <Input v-model.number="graded[s.id].score" type="number" min="0" :max="s.max_points" />
          </div>
          <div class="min-w-[200px] flex-1">
            <Label class="mb-1 block text-xs">Feedback</Label>
            <Input v-model="graded[s.id].feedback" placeholder="Constructive feedback…" />
          </div>
          <Button size="sm" variant="ghost" :loading="aiBusy === s.id" title="Draft feedback with AI" @click="aiAssist(s)"><Sparkles class="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" @click="requestResubmit(s)">Request resubmit</Button>
          <Button size="sm" :loading="saving === s.id" @click="grade(s)"><Check class="h-4 w-4" /> Submit grade</Button>
        </div>
      </Card>
    </div>

    <EmptyState v-else :icon="Inbox" title="Queue is clear" description="No submissions need grading right now. 🎉" />
  </div>
</template>
