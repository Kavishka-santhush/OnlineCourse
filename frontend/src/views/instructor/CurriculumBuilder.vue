<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  ArrowLeft, Plus, Trash2, Pencil, PlayCircle, FileText, Music, BookOpen, ClipboardList,
  Video as VideoIcon, Eye, EyeOff, Loader2, GripVertical, ChevronUp, ChevronDown, Save, X,
} from 'lucide-vue-next';
import { Card, Button, Input, Textarea, Label, Select, Switch, Badge, Modal } from '@/components/ui';
import FileDrop from '@/components/feature/FileDrop.vue';
import { api } from '@/lib/api.js';
import { duration as fmtDuration } from '@/lib/utils.js';
import { useUiStore } from '@/stores/ui.js';

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();
const ui = useUiStore();

const loading = ref(true);
const savingLesson = ref(false);
const busy = ref(false);
const course = ref(null);
const sections = ref([]);
const totalLessons = ref(0);
const totalDuration = ref(0);

const LESSON_TYPES = [
  { value: 'video', label: 'Video' }, { value: 'audio', label: 'Audio' },
  { value: 'article', label: 'Article' }, { value: 'pdf', label: 'PDF' },
  { value: 'quiz', label: 'Quiz' }, { value: 'assignment', label: 'Assignment' },
  { value: 'live_class', label: 'Live class' },
];
const typeIcon = { video: PlayCircle, audio: Music, article: FileText, pdf: FileText, quiz: BookOpen, assignment: ClipboardList, live_class: VideoIcon };

// lesson editor modal
const editOpen = ref(false);
const edit = ref(null); // working copy of a lesson

async function load() {
  loading.value = true;
  try {
    const [cur, detail] = await Promise.all([
      api.get(`/courses/${props.id}/curriculum`),
      api.get(`/courses/${props.id}`),
    ]);
    sections.value = cur.sections || [];
    totalLessons.value = cur.totalLessons || 0;
    totalDuration.value = cur.totalDuration || 0;
    course.value = detail.course;
  } catch (e) {
    ui.toast.error(e.message || 'Could not load curriculum');
    if (e.status === 404) router.back();
  } finally { loading.value = false; }
}

/* ── Sections ──────────────────────────────────────────── */
async function addSection() {
  const title = window.prompt('Section title');
  if (!title?.trim()) return;
  busy.value = true;
  try { await api.post(`/courses/${props.id}/sections`, { title: title.trim() }); await load(); }
  catch (e) { ui.toast.error(e.message); } finally { busy.value = false; }
}
async function renameSection(sec) {
  const title = window.prompt('Rename section', sec.title);
  if (!title || title === sec.title) return;
  try { await api.patch(`/sections/${sec.id}`, { title }); sec.title = title; }
  catch (e) { ui.toast.error(e.message); }
}
async function removeSection(sec) {
  if (!window.confirm(`Delete section "${sec.title}" and its lessons?`)) return;
  try { await api.delete(`/sections/${sec.id}`); await load(); }
  catch (e) { ui.toast.error(e.message); }
}

/* ── Lessons ───────────────────────────────────────────── */
async function addLesson(sec, type = 'video') {
  busy.value = true;
  try {
    const { lesson } = await api.post(`/sections/${sec.id}/lessons`, { title: 'Untitled lesson', type });
    await load();
    const created = sections.value.flatMap((s) => s.lessons).find((l) => l.id === lesson.id);
    if (created) openEditor(created);
  } catch (e) { ui.toast.error(e.message); } finally { busy.value = false; }
}

function openEditor(lesson) {
  edit.value = JSON.parse(JSON.stringify(lesson));
  if (!Array.isArray(edit.value.resources)) edit.value.resources = [];
  editOpen.value = true;
}

async function saveLesson() {
  const l = edit.value;
  savingLesson.value = true;
  try {
    await api.patch(`/lessons/${l.id}`, {
      title: l.title, type: l.type, content: l.content || '', duration_seconds: Number(l.duration_seconds) || 0,
      is_preview: !!l.is_preview, video_url: l.video_url || null, video_path: l.video_path || null,
      attachment_urls: l.attachment_urls || [], resources: l.resources || [],
    });
    ui.toast.success('Lesson saved');
    editOpen.value = false;
    await load();
  } catch (e) { ui.toast.error(e.message || 'Could not save lesson'); }
  finally { savingLesson.value = false; }
}

async function removeLesson(lesson) {
  if (!window.confirm(`Delete lesson "${lesson.title}"?`)) return;
  try { await api.delete(`/lessons/${lesson.id}`); await load(); }
  catch (e) { ui.toast.error(e.message); }
}

function onLessonVideo({ url, path }) { edit.value.video_url = url; edit.value.video_path = path; }
function onAttachment({ url }) {
  edit.value.attachment_urls = [...(edit.value.attachment_urls || []), url];
}
function addResource() { edit.value.resources.push({ name: '', url: '' }); }

/* ── Reordering (up/down within a section, and across sections) ── */
async function persistOrder() {
  const order = sections.value.map((s) => ({ section_id: s.id, lessons: s.lessons.map((l) => l.id) }));
  try { await api.post(`/courses/${props.id}/reorder`, { order }); }
  catch (e) { ui.toast.error(e.message); }
}
function moveLesson(sec, idx, dir) {
  const target = idx + dir;
  if (target < 0 || target >= sec.lessons.length) return;
  [sec.lessons[idx], sec.lessons[target]] = [sec.lessons[target], sec.lessons[idx]];
  persistOrder();
}
function moveSection(idx, dir) {
  const target = idx + dir;
  if (target < 0 || target >= sections.value.length) return;
  [sections.value[idx], sections.value[target]] = [sections.value[target], sections.value[idx]];
  persistOrder();
}

function goQuiz(lesson) {
  router.push({ name: 'quiz-builder', query: { lesson_id: lesson.id, course_id: props.id } });
}

onMounted(load);
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <button class="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" @click="router.push({ name: 'instructor-courses' })">
      <ArrowLeft class="h-4 w-4" /> My courses
    </button>

    <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">Curriculum</h1>
        <p class="mt-1 text-sm text-muted-foreground">{{ course?.title }}</p>
        <p class="text-xs text-muted-foreground">{{ totalLessons }} lessons · {{ fmtDuration(totalDuration) }} total</p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" :loading="busy" @click="addSection"><Plus class="h-4 w-4" /> Section</Button>
        <Button @click="router.push({ name: 'course-edit', params: { id: props.id } })"><Pencil class="h-4 w-4" /> Course details</Button>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-16"><Loader2 class="h-6 w-6 animate-spin text-muted-foreground" /></div>

    <div v-else class="space-y-4">
      <Card v-for="(sec, sIdx) in sections" :key="sec.id" class="overflow-hidden">
        <div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
          <div class="flex flex-col">
            <button :disabled="sIdx === 0" class="text-muted-foreground disabled:opacity-30" @click="moveSection(sIdx, -1)"><ChevronUp class="h-4 w-4" /></button>
            <button :disabled="sIdx === sections.length - 1" class="text-muted-foreground disabled:opacity-30" @click="moveSection(sIdx, 1)"><ChevronDown class="h-4 w-4" /></button>
          </div>
          <p class="flex-1 font-semibold">{{ sec.title }}</p>
          <Button variant="ghost" size="sm" @click="renameSection(sec)"><Pencil class="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" @click="removeSection(sec)"><Trash2 class="h-4 w-4 text-destructive" /></Button>
        </div>

        <ul class="divide-y">
          <li v-for="(l, li) in sec.lessons" :key="l.id" class="flex items-center gap-3 px-4 py-2.5">
            <GripVertical class="h-4 w-4 shrink-0 text-muted-foreground/40" />
            <component :is="typeIcon[l.type] || FileText" class="h-4 w-4 shrink-0 text-primary" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ l.title }}</p>
              <p class="text-xs text-muted-foreground">{{ l.type }}<span v-if="l.duration_seconds"> · {{ fmtDuration(l.duration_seconds) }}</span></p>
            </div>
            <Badge v-if="l.is_preview" variant="success" class="gap-1"><Eye class="h-3 w-3" /> Preview</Badge>
            <div class="flex items-center gap-0.5">
              <button class="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30" :disabled="li === 0" @click="moveLesson(sec, li, -1)"><ChevronUp class="h-4 w-4" /></button>
              <button class="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30" :disabled="li === sec.lessons.length - 1" @click="moveLesson(sec, li, 1)"><ChevronDown class="h-4 w-4" /></button>
              <button v-if="l.type === 'quiz'" class="rounded p-1 text-muted-foreground hover:bg-accent" title="Edit quiz" @click="goQuiz(l)"><BookOpen class="h-4 w-4" /></button>
              <button class="rounded p-1 text-muted-foreground hover:bg-accent" title="Edit lesson" @click="openEditor(l)"><Pencil class="h-4 w-4" /></button>
              <button class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive" title="Delete" @click="removeLesson(l)"><Trash2 class="h-4 w-4" /></button>
            </div>
          </li>
          <li v-if="!sec.lessons.length" class="px-4 py-3 text-sm text-muted-foreground">No lessons yet.</li>
        </ul>

        <div class="flex items-center gap-2 border-t px-4 py-2.5">
          <span class="text-xs text-muted-foreground">Add lesson:</span>
          <Button v-for="t in LESSON_TYPES.slice(0, 4)" :key="t.value" size="sm" variant="outline" :disabled="busy" @click="addLesson(sec, t.value)">
            <component :is="typeIcon[t.value]" class="h-3.5 w-3.5" /> {{ t.label }}
          </Button>
          <Select :model-value="''" :options="LESSON_TYPES" placeholder="More…" class="h-8 w-auto text-xs"
            @update:model-value="(v) => v && addLesson(sec, v)" />
        </div>
      </Card>

      <Card v-if="!sections.length" class="p-10 text-center">
        <p class="text-muted-foreground">No sections yet. Add a section to start building your curriculum.</p>
        <Button class="mt-4" @click="addSection"><Plus class="h-4 w-4" /> Add section</Button>
      </Card>
    </div>

    <!-- lesson editor -->
    <Modal v-model:open="editOpen" title="Edit lesson" size="lg">
      <div v-if="edit" class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <Label class="mb-1.5 block">Title</Label>
            <Input v-model="edit.title" />
          </div>
          <div>
            <Label class="mb-1.5 block">Type</Label>
            <Select v-model="edit.type" :options="LESSON_TYPES" />
          </div>
        </div>
        <div>
          <Label class="mb-1.5 block">Duration (seconds)</Label>
          <Input v-model="edit.duration_seconds" type="number" min="0" class="max-w-[180px]" />
        </div>

        <!-- content by type -->
        <div v-if="['article'].includes(edit.type)">
          <Label class="mb-1.5 block">Content (HTML)</Label>
          <Textarea v-model="edit.content" rows="10" class="font-mono text-xs" placeholder="<p>Lesson body…</p>" />
        </div>

        <div v-if="edit.type === 'video' || edit.type === 'audio'">
          <Label class="mb-1.5 block">Media file</Label>
          <Input v-model="edit.video_url" :placeholder="edit.type === 'video' ? 'URL or upload below' : 'Audio URL'" class="mb-2" />
          <FileDrop :bucket="edit.type === 'audio' ? 'media' : 'videos'" :folder="`courses/${id}`" :accept="edit.type === 'audio' ? 'audio/*' : 'video/*'" label="Upload media" @uploaded="onLessonVideo" />
        </div>

        <div v-if="edit.type === 'pdf'">
          <Label class="mb-1.5 block">PDF / attachments</Label>
          <div v-if="edit.attachment_urls?.length" class="mb-2 space-y-1">
            <div v-for="(u, i) in edit.attachment_urls" :key="i" class="flex items-center gap-2 text-sm">
              <FileText class="h-4 w-4 text-muted-foreground" /><span class="flex-1 truncate">{{ u }}</span>
              <button class="text-muted-foreground hover:text-destructive" @click="edit.attachment_urls.splice(i, 1)"><X class="h-4 w-4" /></button>
            </div>
          </div>
          <FileDrop bucket="files" :folder="`courses/${id}`" accept="application/pdf" label="Upload a PDF" @uploaded="onAttachment" />
        </div>

        <div v-if="edit.type === 'assignment' || edit.type === 'quiz'">
          <p class="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            This lesson links to a {{ edit.type }}. Use the {{ edit.type }} builder to create and manage its {{ edit.type }} content.
          </p>
        </div>

        <!-- resources -->
        <div>
          <div class="mb-1.5 flex items-center justify-between">
            <Label>Resources</Label>
            <Button size="sm" variant="ghost" @click="addResource"><Plus class="h-3.5 w-3.5" /> Add</Button>
          </div>
          <div v-for="(r, i) in edit.resources" :key="i" class="mb-2 flex gap-2">
            <Input v-model="r.name" placeholder="Name" />
            <Input v-model="r.url" placeholder="https://…" />
            <Button variant="ghost" size="icon" @click="edit.resources.splice(i, 1)"><Trash2 class="h-4 w-4" /></Button>
          </div>
        </div>

        <div class="flex items-center justify-between rounded-lg border p-3">
          <div class="flex items-center gap-2">
            <EyeOff v-if="!edit.is_preview" class="h-4 w-4 text-muted-foreground" /><Eye v-else class="h-4 w-4 text-emerald-500" />
            <div><p class="text-sm font-medium">Free preview</p><p class="text-xs text-muted-foreground">Let non-students watch before buying.</p></div>
          </div>
          <Switch v-model="edit.is_preview" />
        </div>
      </div>

      <template #footer>
        <Button variant="outline" @click="editOpen = false">Cancel</Button>
        <Button :loading="savingLesson" @click="saveLesson"><Save class="h-4 w-4" /> Save lesson</Button>
      </template>
    </Modal>
  </div>
</template>
