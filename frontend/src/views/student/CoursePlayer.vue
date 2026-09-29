<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import {
  ChevronLeft, PlayCircle, FileText, BookOpen, Music, ClipboardList, Video as VideoIcon,
  CheckCircle2, Circle, ListChecks, Loader2, ExternalLink, Award, MessageSquare, ChevronRight,
} from 'lucide-vue-next';
import { Button, Progress, Badge, Card, Skeleton, Textarea, Modal } from '@/components/ui';
import VideoPlayer from '@/components/feature/VideoPlayer.vue';
import QuizAttempt from './QuizAttempt.vue';
import { api } from '@/lib/api.js';
import { duration, formatDate } from '@/lib/utils.js';
import { useUiStore } from '@/stores/ui.js';

const props = defineProps({ slug: { type: String, required: true } });
const route = useRoute();
const router = useRouter();
const ui = useUiStore();

const loading = ref(true);
const course = ref(null);
const lessons = ref([]);            // flat, ordered (from progress)
const percent = ref(0);
const activeId = ref(null);
const playUrl = ref('');
const sidebarOpen = ref(false);
const showNotes = ref(false);
const notes = ref('');
const assignText = ref('');
const assignDone = ref(false);
const assignBusy = ref(false);

const typeIcon = { video: PlayCircle, article: FileText, pdf: FileText, audio: Music, quiz: BookOpen, assignment: ClipboardList, live_class: VideoIcon };

const active = computed(() => lessons.value.find((l) => l.id === activeId.value) || null);
const grouped = computed(() => {
  const map = new Map();
  for (const s of course.value?.sections || []) map.set(s.id, { ...s, lessons: [] });
  for (const l of lessons.value) {
    const sec = map.get(l.section_id);
    if (sec) sec.lessons.push(l); else map.set('other', { id: 'other', title: 'Lessons', lessons: [] }), map.get('other').lessons.push(l);
  }
  return [...map.values()].filter((s) => s.lessons.length);
});
const idx = computed(() => lessons.value.findIndex((l) => l.id === activeId.value));
const prev = computed(() => lessons.value[idx.value - 1] || null);
const next = computed(() => lessons.value[idx.value + 1] || null);
const isCompleted = (l) => !!l.progress?.completed;

async function load() {
  loading.value = true;
  try {
    const detail = await api.get(`/courses/${props.slug}`);
    course.value = detail.course;
    const prog = await api.get(`/progress/${detail.course.id}`);
    lessons.value = prog.lessons || [];
    percent.value = prog.percent || 0;
    activeId.value = route.query.lesson || prog.nextLesson?.id || lessons.value[0]?.id;
    await openLesson(activeId.value);
  } catch (e) {
    if (e.status === 403) { ui.toast.error('Enroll to access this course'); return router.replace({ name: 'course-detail', params: { slug: props.slug } }); }
    if (e.status === 404) return router.replace({ name: 'not-found' });
    ui.toast.error(e.message || 'Could not load course');
  } finally { loading.value = false; }
}

async function openLesson(id) {
  activeId.value = id;
  playUrl.value = '';
  sidebarOpen.value = false;
  const l = lessons.value.find((x) => x.id === id);
  if (!l) return;
  notes.value = '';
  assignText.value = '';
  assignDone.value = false;
  if ((l.type === 'video' || l.type === 'audio') && l.video_path) {
    try { playUrl.value = (await api.get('/media/signed-url', { params: { bucket: 'videos', path: l.video_path } })).url; }
    catch { playUrl.value = l.video_url || ''; }
  } else {
    playUrl.value = l.video_url || '';
  }
  // record a view
  api.post(`/recently-viewed/${course.value.id}`).catch(() => {});
}

async function selectLesson(l) {
  await flushPosition();
  router.replace({ query: { ...route.query, lesson: l.id } });
  await openLesson(l.id);
}

// Position tracking so students can resume exactly where they stopped.
let pendingPosition = 0;
function onTime({ currentTime, duration: total }) {
  pendingPosition = Math.round(currentTime);
  if (total && currentTime / total >= 0.9 && !isCompleted(active.value)) completeLesson(active.value, true);
}
async function flushPosition() {
  const l = active.value;
  if (!l || l.type === 'quiz' || l.type === 'assignment') return;
  try {
    const res = await api.post('/progress/lesson', { course_id: course.value.id, lesson_id: l.id, position_seconds: pendingPosition, watched_seconds: pendingPosition });
    percent.value = res.percent ?? percent.value;
  } catch { /* ignore */ }
}

async function completeLesson(l, mark = true) {
  if (!l) return;
  try {
    const res = await api.post('/progress/lesson', { course_id: course.value.id, lesson_id: l.id, completed: mark, position_seconds: l.progress?.position_seconds || 0 });
    if (l.progress) l.progress.completed = mark; else l.progress = { completed: mark, position_seconds: 0 };
    percent.value = res.percent ?? percent.value;
    if (res.complete) ui.toast.success('Course complete! 🎉 Certificate issued.');
  } catch (e) { ui.toast.error(e.message); }
}

async function goNext() { if (next.value) await selectLesson(next.value); }

async function submitAssignment() {
  const l = active.value;
  if (!l?.assignment_id) return ui.toast.error('This assignment is not configured yet.');
  assignBusy.value = true;
  try {
    await api.post(`/assignments/${l.assignment_id}/submit`, { text: assignText.value });
    assignDone.value = true;
    ui.toast.success('Assignment submitted');
  } catch (e) { ui.toast.error(e.message || 'Submission failed'); }
  finally { assignBusy.value = false; }
}

// Study-time heartbeat.
let hb = null;
onMounted(() => {
  load();
  hb = setInterval(async () => { if (active.value && (active.value.type === 'video' || active.value.type === 'article')) { try { await api.post('/progress/study-time', { seconds: 30 }); } catch {} } }, 30000);
});
watch(() => props.slug, load);
</script>

<template>
  <div class="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
    <!-- top bar -->
    <header class="flex h-14 items-center gap-3 border-b border-white/10 px-4">
      <button class="rounded-md p-1.5 hover:bg-white/10" @click="sidebarOpen = !sidebarOpen"><ListChecks class="h-5 w-5" /></button>
      <RouterLink to="/app/dashboard" class="flex items-center gap-1 text-sm text-neutral-300 hover:text-white"><ChevronLeft class="h-4 w-4" /> Dashboard</RouterLink>
      <div class="min-w-0 flex-1 text-center">
        <p class="truncate text-sm font-medium">{{ course?.title }}</p>
      </div>
      <div class="hidden items-center gap-3 sm:flex">
        <div class="w-32"><Progress :model-value="percent" color="bg-emerald-500" /></div>
        <span class="w-9 text-right text-xs tabular-nums text-neutral-400">{{ percent }}%</span>
      </div>
    </header>

    <div class="flex flex-1 overflow-hidden">
      <!-- sidebar -->
      <aside
        :class="[
          'absolute inset-y-0 left-0 z-40 w-80 transform overflow-y-auto border-r border-white/10 bg-neutral-900 transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0 pt-14' : '-translate-x-full pt-0',
        ]">
        <div class="border-b border-white/10 p-4">
          <p class="text-sm font-semibold">{{ course?.title }}</p>
          <p class="mt-1 text-xs text-neutral-400">{{ lessons.length }} lessons · {{ duration(course?.total_duration_seconds) }}</p>
        </div>
        <nav class="p-2">
          <div v-for="sec in grouped" :key="sec.id" class="mb-3">
            <p class="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">{{ sec.title }}</p>
            <button v-for="l in sec.lessons" :key="l.id" @click="selectLesson(l)"
              :class="['flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition',
                l.id === activeId ? 'bg-white/10 text-white' : 'text-neutral-400 hover:bg-white/5']">
              <CheckCircle2 v-if="isCompleted(l)" class="h-4 w-4 shrink-0 text-emerald-500" />
              <Circle v-else class="h-4 w-4 shrink-0 text-neutral-600" />
              <component :is="typeIcon[l.type] || FileText" class="h-4 w-4 shrink-0 opacity-60" />
              <span class="flex-1 truncate">{{ l.title }}</span>
              <span class="shrink-0 text-xs text-neutral-500">{{ duration(l.duration_seconds) }}</span>
            </button>
          </div>
        </nav>
      </aside>
      <div v-if="sidebarOpen" class="fixed inset-0 z-30 bg-black/60 lg:hidden" @click="sidebarOpen = false" />

      <!-- content -->
      <main class="flex flex-1 flex-col overflow-y-auto">
        <div v-if="loading" class="flex flex-1 items-center justify-center"><Loader2 class="h-8 w-8 animate-spin text-neutral-500" /></div>

        <template v-else-if="active">
          <div class="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
            <h1 class="text-xl font-bold">{{ active.title }}</h1>
            <p class="mt-1 text-sm text-neutral-400">{{ active.type }} · {{ duration(active.duration_seconds) }}</p>

            <div class="mt-5 rounded-xl border border-white/10 bg-black">
              <!-- video / audio -->
              <VideoPlayer v-if="(active.type === 'video' || active.type === 'audio') && playUrl" :key="active.id" :src="playUrl" :type="active.type === 'audio' ? 'audio/mp4' : 'video/mp4'" :start-time="active.progress?.position_seconds || 0" @timeupdate="onTime" @progress="(p) => p >= 100 && completeLesson(active, true)" />
              <div v-else-if="active.type === 'video' || active.type === 'audio'" class="flex aspect-video items-center justify-center text-neutral-500">No media available for this lesson.</div>

              <!-- article / pdf -->
              <div v-else-if="active.type === 'article'" class="p-6">
                <div class="prose-invert max-w-none text-neutral-200" v-html="active.content || '<p>No content.</p>'"></div>
              </div>
              <div v-else-if="active.type === 'pdf'" class="p-6">
                <iframe v-if="active.attachment_urls?.[0]" :src="active.attachment_urls[0]" class="h-[70vh] w-full rounded-lg bg-white" />
                <p v-else class="text-neutral-400">No PDF attached.</p>
              </div>

              <!-- quiz -->
              <div v-else-if="active.type === 'quiz'" class="p-6">
                <Card v-if="active.quiz_id" class="border-white/10 bg-neutral-900 p-0">
                  <QuizAttempt :id="String(active.quiz_id)" embedded />
                </Card>
                <p v-else class="text-neutral-400">This quiz is not configured yet.</p>
              </div>

              <!-- assignment -->
              <div v-else-if="active.type === 'assignment'" class="p-6 text-neutral-300">
                <div class="mb-3 text-sm" v-html="active.content || 'Submit your work below.'"></div>
                <textarea v-model="assignText" rows="6" class="w-full rounded-lg border border-white/10 bg-neutral-800 p-3 text-sm text-neutral-100" placeholder="Your answer, notes, or a link to your submission…"></textarea>
                <div class="mt-3 flex items-center gap-3">
                  <Button size="sm" :loading="assignBusy" @click="submitAssignment">Submit assignment</Button>
                  <span v-if="assignDone" class="text-sm text-emerald-400">Submitted ✔</span>
                </div>
              </div>

              <!-- live class -->
              <div v-else-if="active.type === 'live_class'" class="p-6 text-neutral-300">
                <VideoIcon class="mb-2 h-8 w-8 text-primary" />
                <p>This is a live-class session. Check the schedule in your dashboard to join.</p>
              </div>

              <div v-else class="p-6 text-neutral-400" v-html="active.content || 'No content.'"></div>
            </div>

            <!-- resources / notes -->
            <div v-if="active.resources?.length" class="mt-4 space-y-2">
              <p class="text-sm font-semibold text-neutral-300">Resources</p>
              <a v-for="(r, i) in active.resources" :key="i" :href="r.url" target="_blank" rel="noopener"
                class="flex items-center gap-2 text-sm text-neutral-400 hover:text-white"><ExternalLink class="h-4 w-4" /> {{ r.name || r.url }}</a>
            </div>

            <div class="mt-4 flex gap-2">
              <Button variant="outline" size="sm" @click="showNotes = true"><MessageSquare class="h-4 w-4" /> My notes</Button>
            </div>
          </div>

          <!-- footer nav -->
          <div class="sticky bottom-0 border-t border-white/10 bg-neutral-900 px-4 py-3">
            <div class="mx-auto flex max-w-4xl items-center justify-between">
              <Button variant="ghost" size="sm" :disabled="!prev" @click="prev && selectLesson(prev)"><ChevronLeft class="h-4 w-4" /> Previous</Button>
              <div class="flex items-center gap-2">
                <Button :variant="isCompleted(active) ? 'outline' : 'default'" size="sm" @click="completeLesson(active, !isCompleted(active))">
                  <CheckCircle2 class="h-4 w-4" /> {{ isCompleted(active) ? 'Completed' : 'Mark complete' }}
                </Button>
                <Button v-if="next" size="sm" @click="goNext">Next <ChevronRight class="h-4 w-4" /></Button>
                <RouterLink v-else-if="percent >= 100" to="/app/certificates"><Button size="sm" variant="secondary"><Award class="h-4 w-4" /> Get certificate</Button></RouterLink>
              </div>
            </div>
          </div>
        </template>
      </main>
    </div>

    <!-- notes modal -->
    <Modal v-model:open="showNotes" title="Lesson notes">
      <p class="mb-2 text-sm text-muted-foreground">{{ active?.title }}</p>
      <Textarea v-model="notes" rows="10" placeholder="Jot down your notes for this lesson…" />
      <template #footer><Button @click="showNotes = false">Done</Button></template>
    </Modal>
  </div>
</template>
