<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { Plus, Pencil, Trash2, Users, Loader2, ClipboardList, X, Sparkles, Check } from 'lucide-vue-next';
import { Card, Button, Input, Textarea, Label, Select, Switch, Badge, Modal } from '@/components/ui';
import EmptyState from '@/components/feature/EmptyState.vue';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';
import { useUiStore } from '@/stores/ui.js';

const ui = useUiStore();
const loading = ref(true);
const busy = ref(false);
const courses = ref([]);
const courseId = ref('');
const assignments = ref([]);

const courseOptions = computed(() => courses.value.map((c) => ({ value: c.id, label: c.title })));

// create/edit modal
const editOpen = ref(false);
const edit = ref(null);

// submissions modal
const subsOpen = ref(false);
const subsAssignment = ref(null);
const subs = ref([]);
const subsLoading = ref(false);

function blank(courseIdVal) {
  return { id: null, course_id: courseIdVal, lesson_id: '', title: '', instructions: '', due_date: '', max_points: 100, allow_late: true, peer_review: false };
}

async function loadCourses() {
  try {
    courses.value = (await api.get('/courses/instructor/mine')).courses || [];
    if (courses.value.length && !courseId.value) courseId.value = courses.value[0].id;
  } catch (e) { ui.toast.error(e.message); }
}

async function loadAssignments() {
  if (!courseId.value) { assignments.value = []; return; }
  loading.value = true;
  try { assignments.value = (await api.get(`/assignments/course/${courseId.value}`)).assignments || []; }
  catch (e) { ui.toast.error(e.message); }
  finally { loading.value = false; }
}
watch(courseId, loadAssignments);

function newAssignment() { edit.value = blank(courseId.value); editOpen.value = true; }
function editAssignment(a) {
  edit.value = {
    id: a.id, course_id: a.course_id, lesson_id: a.lesson_id || '', title: a.title, instructions: a.instructions || '',
    due_date: a.due_date ? a.due_date.slice(0, 10) : '', max_points: a.max_points ?? 100,
    allow_late: !!a.allow_late, peer_review: !!a.peer_review,
  };
  editOpen.value = true;
}

async function saveAssignment() {
  const a = edit.value;
  if (!a.title.trim()) return ui.toast.error('Title is required');
  if (!a.course_id) return ui.toast.error('Pick a course');
  busy.value = true;
  try {
    const body = {
      course_id: a.course_id, lesson_id: a.lesson_id || undefined, title: a.title, instructions: a.instructions || undefined,
      due_date: a.due_date || undefined, max_points: Number(a.max_points) || 100, allow_late: a.allow_late, peer_review: a.peer_review,
    };
    if (a.id) await api.patch(`/assignments/${a.id}`, body);
    else await api.post('/assignments', body);
    ui.toast.success('Assignment saved');
    editOpen.value = false;
    await loadAssignments();
  } catch (e) { ui.toast.error(e.message || 'Could not save'); }
  finally { busy.value = false; }
}

async function removeAssignment(a) {
  if (!window.confirm(`Delete assignment "${a.title}"?`)) return;
  try { await api.delete(`/assignments/${a.id}`); ui.toast.success('Deleted'); await loadAssignments(); }
  catch (e) { ui.toast.error(e.message); }
}

async function openSubmissions(a) {
  subsAssignment.value = a; subsOpen.value = true; subsLoading.value = true; subs.value = [];
  try {
    subs.value = (await api.get(`/assignments/${a.id}/submissions`)).submissions || [];
    for (const s of subs.value) grades[s.id] = grades[s.id] || { score: s.score ?? '', feedback: s.feedback ?? '' };
  } catch (e) { ui.toast.error(e.message); }
  finally { subsLoading.value = false; }
}

// inline grading
const grades = reactive({});   // { [submissionId]: { score, feedback } }
const grading = ref(null);     // submission id being saved
const aiBusy = ref(null);

async function gradeSubmission(s) {
  const g = grades[s.id] || {};
  if (g.score === '' || g.score == null) return ui.toast.error('Enter a score');
  grading.value = s.id;
  try {
    const { submission } = await api.post(`/submissions/${s.id}/grade`, { score: Number(g.score), feedback: g.feedback || '' });
    Object.assign(s, { status: submission.status, score: submission.score, feedback: submission.feedback });
    ui.toast.success('Grade saved');
  } catch (e) { ui.toast.error(e.message || 'Could not grade'); }
  finally { grading.value = null; }
}

async function aiAssist(s) {
  aiBusy.value = s.id;
  try {
    const { feedback } = await api.post('/assignments/feedback-assistant', {
      submission_text: s.text_submission, assignment_title: subsAssignment.value?.title,
    });
    grades[s.id] = { ...(grades[s.id] || {}), feedback };
  } catch (e) { ui.toast.error(e.message || 'AI unavailable'); }
  finally { aiBusy.value = null; }
}

onMounted(async () => { await loadCourses(); await loadAssignments(); });
</script>

<template>
  <div>
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="flex items-center gap-2 text-2xl font-bold"><ClipboardList class="h-6 w-6" /> Assignments</h1>
        <p class="mt-1 text-sm text-muted-foreground">Create assignments and review submissions.</p>
      </div>
      <div class="flex items-center gap-2">
        <Select v-model="courseId" :options="courseOptions" placeholder="Select a course" class="w-64" />
        <Button :disabled="!courseId" @click="newAssignment"><Plus class="h-4 w-4" /> New</Button>
      </div>
    </div>

    <div v-if="!courses.length" class="py-10 text-center text-muted-foreground">Create a course first, then add assignments to it.</div>

    <div v-else-if="loading" class="flex justify-center py-16"><Loader2 class="h-6 w-6 animate-spin text-muted-foreground" /></div>

    <div v-else-if="assignments.length" class="space-y-3">
      <Card v-for="a in assignments" :key="a.id" class="flex flex-wrap items-center gap-3 p-4">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-semibold">{{ a.title }}</span>
            <Badge variant="outline">{{ a.max_points }} pts</Badge>
            <Badge v-if="a.peer_review" variant="secondary">Peer review</Badge>
          </div>
          <p class="mt-0.5 text-xs text-muted-foreground">{{ a.due_date ? `Due ${formatDate(a.due_date)}` : 'No due date' }}</p>
        </div>
        <div class="flex items-center gap-1">
          <Button size="sm" variant="outline" @click="openSubmissions(a)"><Users class="h-4 w-4" /> Submissions</Button>
          <Button variant="ghost" size="icon" @click="editAssignment(a)"><Pencil class="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" @click="removeAssignment(a)"><Trash2 class="h-4 w-4 text-destructive" /></Button>
        </div>
      </Card>
    </div>

    <EmptyState v-else :icon="ClipboardList" title="No assignments yet" description="Add an assignment for this course." />

    <!-- create/edit -->
    <Modal v-model:open="editOpen" :title="edit?.id ? 'Edit assignment' : 'New assignment'" size="lg">
      <div v-if="edit" class="space-y-4">
        <div><Label class="mb-1.5 block">Title</Label><Input v-model="edit.title" /></div>
        <div><Label class="mb-1.5 block">Instructions</Label><Textarea v-model="edit.instructions" rows="5" placeholder="What should students do?" /></div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div><Label class="mb-1.5 block">Due date</Label><Input v-model="edit.due_date" type="date" /></div>
          <div><Label class="mb-1.5 block">Max points</Label><Input v-model="edit.max_points" type="number" min="1" class="max-w-[140px]" /></div>
        </div>
        <div class="flex flex-wrap gap-6">
          <label class="flex items-center gap-2 text-sm">Allow late <Switch v-model="edit.allow_late" /></label>
          <label class="flex items-center gap-2 text-sm">Peer review <Switch v-model="edit.peer_review" /></label>
        </div>
      </div>
      <template #footer>
        <Button variant="outline" @click="editOpen = false">Cancel</Button>
        <Button :loading="busy" @click="saveAssignment">Save assignment</Button>
      </template>
    </Modal>

    <!-- submissions -->
    <Modal v-model:open="subsOpen" :title="`Submissions — ${subsAssignment?.title || ''}`" size="xl">
      <div v-if="subsLoading" class="flex justify-center py-10"><Loader2 class="h-6 w-6 animate-spin text-muted-foreground" /></div>
      <div v-else-if="subs.length" class="space-y-3">
        <div v-for="s in subs" :key="s.id" class="rounded-lg border p-4">
          <div class="flex items-center justify-between">
            <p class="font-medium">{{ s.student?.display_name }}</p>
            <div class="flex items-center gap-2">
              <Badge :variant="s.status === 'graded' ? 'success' : 'muted'">{{ s.status }}</Badge>
              <span v-if="s.status === 'graded'" class="text-sm font-semibold">{{ s.score }}/{{ subsAssignment?.max_points }}</span>
            </div>
          </div>
          <p v-if="s.text_submission" class="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{{ s.text_submission }}</p>
          <div v-if="s.files?.length" class="mt-2 flex flex-wrap gap-2">
            <a v-for="(f, i) in s.files" :key="i" :href="f.url" target="_blank" rel="noopener" class="text-sm text-primary hover:underline">{{ f.name }}</a>
          </div>
          <p class="mt-1 text-xs text-muted-foreground">{{ s.submitted_at ? formatDate(s.submitted_at, 'DD MMM YYYY HH:mm') : '' }}</p>

          <!-- grade -->
          <div class="mt-3 rounded-lg bg-muted/50 p-3">
            <div class="flex items-end gap-2">
              <div class="w-24">
                <Label class="mb-1 block text-xs">Score / {{ subsAssignment?.max_points }}</Label>
                <Input v-model.number="grades[s.id].score" type="number" min="0" :max="subsAssignment?.max_points" />
              </div>
              <div class="flex-1">
                <Label class="mb-1 block text-xs">Feedback</Label>
                <Input v-model="grades[s.id].feedback" placeholder="Comments for the student…" />
              </div>
              <Button size="sm" variant="ghost" :loading="aiBusy === s.id" title="AI draft feedback" @click="aiAssist(s)"><Sparkles class="h-4 w-4" /></Button>
              <Button size="sm" :loading="grading === s.id" @click="gradeSubmission(s)"><Check class="h-4 w-4" /> Grade</Button>
            </div>
          </div>
        </div>
        <p class="text-sm text-muted-foreground">Use the <RouterLink to="/app/instructor/grading" class="text-primary hover:underline">Grading queue</RouterLink> to work across all courses.</p>
      </div>
      <p v-else class="py-6 text-center text-sm text-muted-foreground">No submissions yet.</p>
      <template #footer><Button variant="outline" @click="subsOpen = false"><X class="h-4 w-4" /> Close</Button></template>
    </Modal>
  </div>
</template>
