<script setup>
import { ref, computed, onMounted } from 'vue';
import {
  Video, Plus, Trash2, Users, Hand, MonitorPlay, LogIn, Send, Loader2, Radio, CalendarClock,
} from 'lucide-vue-next';
import { Card, Button, Input, Textarea, Label, Select, Switch, Badge, Modal } from '@/components/ui';
import EmptyState from '@/components/feature/EmptyState.vue';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';
import { useUiStore } from '@/stores/ui.js';
import { useAuthStore } from '@/stores/auth.js';
import { useLiveClass } from '@/composables/useLiveClass.js';

const ui = useUiStore();
const auth = useAuthStore();
const live = useLiveClass();

const loading = ref(true);
const busy = ref(false);
const classes = ref([]);
const courses = ref([]);

const createOpen = ref(false);
const form = ref({ title: '', course_id: '', description: '', starts_at: '', duration_minutes: 60, max_participants: 0, is_public: false });

const roomOpen = ref(false);
const room = ref(null);
const chatText = ref('');

const courseOptions = computed(() => [
  { value: '', label: 'No course (public session)' },
  ...courses.value.map((c) => ({ value: c.id, label: c.title })),
]);

async function load() {
  loading.value = true;
  try {
    const [lc, mine] = await Promise.all([
      api.get('/live-classes'),
      api.get('/courses/instructor/mine').catch(() => ({ courses: [] })),
    ]);
    classes.value = lc.liveClasses || [];
    courses.value = mine.courses || [];
  } catch (e) { ui.toast.error(e.message || 'Could not load live classes'); }
  finally { loading.value = false; }
}

async function create() {
  if (!form.value.title.trim()) return ui.toast.error('Title is required');
  if (!form.value.starts_at) return ui.toast.error('Pick a start date & time');
  busy.value = true;
  try {
    await api.post('/live-classes', {
      title: form.value.title, course_id: form.value.course_id || undefined,
      description: form.value.description || undefined, starts_at: new Date(form.value.starts_at).toISOString(),
      duration_minutes: Number(form.value.duration_minutes) || 60,
      max_participants: Number(form.value.max_participants) || 0, is_public: form.value.is_public,
    });
    ui.toast.success('Live class scheduled');
    createOpen.value = false;
    form.value = { title: '', course_id: '', description: '', starts_at: '', duration_minutes: 60, max_participants: 0, is_public: false };
    await load();
  } catch (e) { ui.toast.error(e.message || 'Could not schedule'); }
  finally { busy.value = false; }
}

async function remove(c) {
  if (!window.confirm(`Delete "${c.title}"?`)) return;
  try { await api.delete(`/live-classes/${c.id}`); ui.toast.success('Deleted'); await load(); }
  catch (e) { ui.toast.error(e.message); }
}

async function openRoom(c) {
  room.value = c; roomOpen.value = true;
  live.connect(c.id);
}
function closeRoom() {
  live.disconnect();
  roomOpen.value = false;
  room.value = null;
  chatText.value = '';
}
function sendChat() {
  const t = chatText.value.trim();
  if (!t) return;
  live.send(t);
  chatText.value = '';
}

onMounted(load);
</script>

<template>
  <div>
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="flex items-center gap-2 text-2xl font-bold"><Video class="h-6 w-6" /> Live classes</h1>
        <p class="mt-1 text-sm text-muted-foreground">Schedule sessions and go live with your students.</p>
      </div>
      <Button @click="createOpen = true"><Plus class="h-4 w-4" /> Schedule class</Button>
    </div>

    <div v-if="loading" class="flex justify-center py-16"><Loader2 class="h-6 w-6 animate-spin text-muted-foreground" /></div>

    <div v-else-if="classes.length" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card v-for="c in classes" :key="c.id" class="flex flex-col p-5">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="truncate font-semibold">{{ c.title }}</p>
            <p v-if="c.course?.title" class="truncate text-sm text-muted-foreground">{{ c.course.title }}</p>
          </div>
          <Badge :variant="c.is_public ? 'success' : 'muted'">{{ c.is_public ? 'Public' : 'Private' }}</Badge>
        </div>
        <div class="mt-3 space-y-1 text-sm text-muted-foreground">
          <p class="flex items-center gap-1.5"><CalendarClock class="h-4 w-4" /> {{ formatDate(c.starts_at, 'DD MMM YYYY HH:mm') }}</p>
          <p class="flex items-center gap-1.5"><Video class="h-4 w-4" /> {{ c.duration_minutes }} min</p>
          <p v-if="c.max_participants" class="flex items-center gap-1.5"><Users class="h-4 w-4" /> up to {{ c.max_participants }} seats</p>
        </div>
        <div class="mt-4 flex items-center gap-2 border-t pt-3">
          <Button size="sm" @click="openRoom(c)"><Radio class="h-4 w-4" /> Open room</Button>
          <Button size="sm" variant="ghost" @click="remove(c)"><Trash2 class="h-4 w-4 text-destructive" /></Button>
        </div>
      </Card>
    </div>

    <EmptyState v-else :icon="Video" title="No live classes" description="Schedule your first live session to meet students in real time." />

    <!-- create -->
    <Modal v-model:open="createOpen" title="Schedule a live class" size="lg">
      <div class="space-y-4">
        <div><Label class="mb-1.5 block">Title</Label><Input v-model="form.title" placeholder="e.g. Q&A: Final project review" /></div>
        <div><Label class="mb-1.5 block">Course</Label><Select v-model="form.course_id" :options="courseOptions" /></div>
        <div><Label class="mb-1.5 block">Description</Label><Textarea v-model="form.description" rows="3" /></div>
        <div class="grid gap-4 sm:grid-cols-3">
          <div><Label class="mb-1.5 block">Starts at</Label><Input v-model="form.starts_at" type="datetime-local" /></div>
          <div><Label class="mb-1.5 block">Duration (min)</Label><Input v-model="form.duration_minutes" type="number" min="5" /></div>
          <div><Label class="mb-1.5 block">Max participants</Label><Input v-model="form.max_participants" type="number" min="0" placeholder="0 = unlimited" /></div>
        </div>
        <label class="flex items-center gap-2 text-sm">Public session <Switch v-model="form.is_public" /></label>
      </div>
      <template #footer>
        <Button variant="outline" @click="createOpen = false">Cancel</Button>
        <Button :loading="busy" @click="create"><Plus class="h-4 w-4" /> Schedule</Button>
      </template>
    </Modal>

    <!-- live room -->
    <Modal v-model:open="roomOpen" :title="room?.title || 'Live room'" size="xl" @close="closeRoom">
      <div class="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div>
          <div class="flex aspect-video items-center justify-center rounded-lg bg-neutral-900 text-neutral-400">
            <div class="text-center">
              <MonitorPlay class="mx-auto h-10 w-10" />
              <p class="mt-2 text-sm">{{ live.connected.value ? 'You are live' : 'Connecting…' }}</p>
            </div>
          </div>
          <div class="mt-3 flex items-center gap-2">
            <Button size="sm" :variant="live.sharing.value ? 'default' : 'outline'" @click="live.toggleScreen(!live.sharing.value)"><MonitorPlay class="h-4 w-4" /> {{ live.sharing.value ? 'Stop sharing' : 'Share screen' }}</Button>
            <Button size="sm" variant="ghost" @click="live.raiseHand(true)"><Hand class="h-4 w-4" /> Raise hand</Button>
            <Badge variant="outline" class="ml-auto">{{ live.participants.value.length }} in room</Badge>
          </div>
          <div v-if="live.hands.value.length" class="mt-2 text-sm text-amber-600"><Hand class="mr-1 inline h-4 w-4" /> {{ live.hands.value.length }} with hand raised</div>
        </div>

        <!-- chat -->
        <div class="flex h-[420px] flex-col rounded-lg border">
          <div class="border-b px-3 py-2 text-sm font-semibold">Chat</div>
          <div class="flex-1 space-y-2 overflow-y-auto p-3">
            <div v-for="(m, i) in live.messages.value" :key="i" class="text-sm">
              <span class="font-medium">{{ m.userId === auth.profile?.id ? 'You' : 'Participant' }}:</span>
              <span class="text-muted-foreground"> {{ m.text }}</span>
            </div>
            <p v-if="!live.messages.value.length" class="text-sm text-muted-foreground">No messages yet.</p>
          </div>
          <div class="flex items-center gap-2 border-t p-2">
            <Input v-model="chatText" placeholder="Message…" @keyup.enter="sendChat" />
            <Button size="icon" @click="sendChat"><Send class="h-4 w-4" /></Button>
          </div>
        </div>
      </div>
      <template #footer>
        <Button variant="outline" @click="closeRoom"><LogIn class="h-4 w-4" /> Leave room</Button>
      </template>
    </Modal>
  </div>
</template>
