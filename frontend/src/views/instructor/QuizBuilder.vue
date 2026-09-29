<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowLeft, Plus, Trash2, Pencil, Save, Loader2, Sparkles, Check, X, GripVertical, Wand2,
} from 'lucide-vue-next';
import { Card, Button, Input, Textarea, Label, Select, Switch, Badge, Modal } from '@/components/ui';
import { api } from '@/lib/api.js';
import { useUiStore } from '@/stores/ui.js';

const route = useRoute();
const router = useRouter();
const ui = useUiStore();

const quizId = computed(() => route.params.id || null);
const loading = ref(false);
const busy = ref(false);
const quiz = ref(null);
const questions = ref([]);

const settings = ref({
  title: '', instructions: '', time_limit_minutes: 0, max_attempts: 0,
  passing_score: 70, shuffle_questions: false, show_answers_after: true,
});

const QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Multiple choice (one answer)' },
  { value: 'multiple_select', label: 'Multiple select (many answers)' },
  { value: 'true_false', label: 'True / False' },
  { value: 'short_answer', label: 'Short answer (manual)' },
  { value: 'code', label: 'Code (manual)' },
];
const typeLabel = (t) => QUESTION_TYPES.find((x) => x.value === t)?.label || t;

/* ── create new quiz ─────────────────────────────────────── */
const creating = ref(!quizId.value);

async function createQuiz() {
  if (!settings.value.title.trim()) return ui.toast.error('Give the quiz a title');
  busy.value = true;
  try {
    const { quiz: q } = await api.post('/quizzes', {
      title: settings.value.title,
      lesson_id: route.query.lesson_id || undefined,
      course_id: route.query.course_id || undefined,
    });
    ui.toast.success('Quiz created');
    creating.value = false;
    router.replace({ name: 'quiz-builder', params: { id: q.id } });
    await load();
  } catch (e) { ui.toast.error(e.message || 'Could not create quiz'); }
  finally { busy.value = false; }
}

/* ── load existing ───────────────────────────────────────── */
async function load() {
  if (!quizId.value) return;
  loading.value = true;
  try {
    const { quiz: q } = await api.get(`/quizzes/${quizId.value}`);
    quiz.value = q;
    questions.value = q.questions || [];
    Object.assign(settings.value, {
      title: q.title || '', instructions: q.instructions || '',
      time_limit_minutes: q.time_limit_minutes || 0, max_attempts: q.max_attempts || 0,
      passing_score: q.passing_score ?? 70, shuffle_questions: !!q.shuffle_questions,
      show_answers_after: q.show_answers_after ?? true,
    });
  } catch (e) { ui.toast.error(e.message || 'Could not load quiz'); router.back(); }
  finally { loading.value = false; }
}

async function saveSettings() {
  busy.value = true;
  try { await api.patch(`/quizzes/${quizId.value}`, settings.value); ui.toast.success('Quiz settings saved'); await load(); }
  catch (e) { ui.toast.error(e.message); } finally { busy.value = false; }
}

/* ── question editor ─────────────────────────────────────── */
const qOpen = ref(false);
const qEdit = ref(null); // working copy {id?, type, prompt, options, correct_answers, points, difficulty, explanation}

function blankQuestion() {
  return { type: 'multiple_choice', prompt: '', options: ['', ''], correct_answers: [], points: 1, difficulty: 'medium', explanation: '' };
}
function newQuestion() { qEdit.value = blankQuestion(); qOpen.value = true; }
function editQuestion(q) {
  qEdit.value = JSON.parse(JSON.stringify({
    id: q.id, type: q.type, prompt: q.prompt, options: q.options || [],
    correct_answers: (q.correct_answers || []).map(String), points: q.points ?? 1,
    difficulty: q.difficulty || 'medium', explanation: q.explanation || '',
  }));
  qOpen.value = true;
}

const isChoice = computed(() => ['multiple_choice', 'multiple_select', 'true_false'].includes(qEdit.value?.type));
const singleAnswer = computed(() => qEdit.value?.type === 'multiple_choice' || qEdit.value?.type === 'true_false');

function setQuizType(t) {
  qEdit.value.type = t;
  qEdit.value.correct_answers = [];
  if (t === 'true_false') qEdit.value.options = ['True', 'False'];
  else if (['short_answer', 'code'].includes(t)) qEdit.value.options = [];
  else if (!qEdit.value.options?.length) qEdit.value.options = ['', ''];
}
function toggleCorrect(idx) {
  const arr = qEdit.value.correct_answers;
  if (singleAnswer.value) qEdit.value.correct_answers = [String(idx)];
  else qEdit.value.correct_answers = arr.includes(String(idx)) ? arr.filter((x) => x !== String(idx)) : [...arr, String(idx)];
}
function addOption() { if (qEdit.value.options.length < 10) qEdit.value.options.push(''); }
function removeOption(i) {
  qEdit.value.options.splice(i, 1);
  qEdit.value.correct_answers = qEdit.value.correct_answers.map(Number).filter((x) => x !== i).map(String);
}

async function saveQuestion() {
  const q = qEdit.value;
  if (!q.prompt.trim()) return ui.toast.error('Enter the question prompt');
  if (isChoice.value && q.options.some((o) => !o.trim())) return ui.toast.error('Options cannot be empty');
  if (isChoice.value && !q.correct_answers.length) return ui.toast.error('Mark at least one correct answer');
  busy.value = true;
  try {
    const body = {
      type: q.type, prompt: q.prompt, options: q.options,
      correct_answers: ['short_answer', 'code'].includes(q.type) ? [] : q.correct_answers,
      points: Number(q.points) || 1, difficulty: q.difficulty, explanation: q.explanation,
    };
    if (q.id) await api.patch(`/questions/${q.id}`, body);
    else await api.post(`/quizzes/${quizId.value}/questions`, body);
    ui.toast.success('Question saved');
    qOpen.value = false;
    await load();
  } catch (e) { ui.toast.error(e.message || 'Could not save question'); }
  finally { busy.value = false; }
}

async function removeQuestion(q) {
  if (!window.confirm('Delete this question?')) return;
  try { await api.delete(`/questions/${q.id}`); await load(); }
  catch (e) { ui.toast.error(e.message); }
}

/* ── AI generation ───────────────────────────────────────── */
const genOpen = ref(false);
const gen = ref({ topic: '', source_text: '', count: 5 });
const genResult = ref([]);
const generating = ref(false);

async function generate() {
  generating.value = true; genResult.value = [];
  try {
    const res = await api.post('/quizzes/generate', {
      quiz_id: quizId.value, topic: gen.value.topic, source_text: gen.value.source_text, count: Number(gen.value.count),
    });
    genResult.value = res.questions || [];
    if (res.saved) { ui.toast.success(`${genResult.value.length} questions added`); await load(); }
  } catch (e) { ui.toast.error(e.message || 'Generation failed'); }
  finally { generating.value = false; }
}

function deleteQuiz() {
  if (!window.confirm('Delete this entire quiz?')) return;
  api.delete(`/quizzes/${quizId.value}`).then(() => { ui.toast.success('Quiz deleted'); router.back(); }).catch((e) => ui.toast.error(e.message));
}

onMounted(load);
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <button class="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" @click="router.back()">
      <ArrowLeft class="h-4 w-4" /> Back
    </button>

    <!-- create -->
    <Card v-if="creating" class="p-6">
      <h1 class="mb-1 text-xl font-bold">New quiz</h1>
      <p class="mb-5 text-sm text-muted-foreground">Name your quiz, then add questions.</p>
      <div class="space-y-4">
        <div><Label class="mb-1.5 block">Quiz title</Label><Input v-model="settings.title" placeholder="e.g. Module 1 Assessment" /></div>
        <div><Label class="mb-1.5 block">Instructions</Label><Textarea v-model="settings.instructions" rows="3" placeholder="Anything students should know before starting…" /></div>
      </div>
      <div class="mt-6 flex justify-end"><Button :loading="busy" @click="createQuiz"><Plus class="h-4 w-4" /> Create quiz</Button></div>
    </Card>

    <div v-else-if="loading" class="flex justify-center py-16"><Loader2 class="h-6 w-6 animate-spin text-muted-foreground" /></div>

    <!-- edit -->
    <div v-else-if="quiz">
      <div class="mb-6 flex items-center justify-between">
        <div><h1 class="text-2xl font-bold">Quiz builder</h1><p class="text-sm text-muted-foreground">{{ questions.length }} questions · passing {{ settings.passing_score }}%</p></div>
        <div class="flex gap-2">
          <Button variant="outline" @click="genOpen = true"><Wand2 class="h-4 w-4" /> AI generate</Button>
          <Button variant="ghost" size="icon" title="Delete quiz" @click="deleteQuiz"><Trash2 class="h-4 w-4 text-destructive" /></Button>
        </div>
      </div>

      <!-- settings -->
      <Card class="mb-6 space-y-4 p-5">
        <div><Label class="mb-1.5 block">Title</Label><Input v-model="settings.title" /></div>
        <div class="grid gap-4 sm:grid-cols-3">
          <div><Label class="mb-1.5 block">Time limit (min)</Label><Input v-model="settings.time_limit_minutes" type="number" min="0" /></div>
          <div><Label class="mb-1.5 block">Max attempts</Label><Input v-model="settings.max_attempts" type="number" min="0" /></div>
          <div><Label class="mb-1.5 block">Passing score %</Label><Input v-model="settings.passing_score" type="number" min="0" max="100" /></div>
        </div>
        <div><Label class="mb-1.5 block">Instructions</Label><Textarea v-model="settings.instructions" rows="2" /></div>
        <div class="flex flex-wrap gap-6">
          <label class="flex items-center gap-2 text-sm">Shuffle questions <Switch v-model="settings.shuffle_questions" /></label>
          <label class="flex items-center gap-2 text-sm">Show answers after <Switch v-model="settings.show_answers_after" /></label>
        </div>
        <div class="flex justify-end"><Button size="sm" :loading="busy" @click="saveSettings"><Save class="h-4 w-4" /> Save settings</Button></div>
      </Card>

      <!-- questions -->
      <div class="space-y-3">
        <Card v-for="(q, i) in questions" :key="q.id" class="p-4">
          <div class="flex items-start gap-3">
            <GripVertical class="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40" />
            <div class="min-w-0 flex-1">
              <div class="mb-1 flex flex-wrap items-center gap-2">
                <Badge variant="muted">{{ typeLabel(q.type) }}</Badge>
                <Badge variant="outline">{{ q.points || 1 }} pt{{ (q.points || 1) > 1 ? 's' : '' }}</Badge>
                <Badge variant="secondary">{{ q.difficulty }}</Badge>
              </div>
              <p class="font-medium">{{ i + 1 }}. {{ q.prompt }}</p>
              <ul v-if="q.options?.length" class="mt-2 space-y-1 text-sm">
                <li v-for="(o, oi) in q.options" :key="oi" class="flex items-center gap-2">
                  <Check v-if="(q.correct_answers || []).map(String).includes(String(oi))" class="h-3.5 w-3.5 text-emerald-600" />
                  <span v-else class="inline-block h-3.5 w-3.5" />
                  {{ o }}
                </li>
              </ul>
            </div>
            <div class="flex gap-0.5">
              <Button variant="ghost" size="icon" @click="editQuestion(q)"><Pencil class="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" @click="removeQuestion(q)"><Trash2 class="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        </Card>
      </div>

      <Button class="mt-4 w-full" variant="outline" @click="newQuestion"><Plus class="h-4 w-4" /> Add question</Button>
    </div>

    <!-- question modal -->
    <Modal v-model:open="qOpen" :title="qEdit?.id ? 'Edit question' : 'New question'" size="xl">
      <div v-if="qEdit" class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <div><Label class="mb-1.5 block">Type</Label><Select :model-value="qEdit.type" :options="QUESTION_TYPES" @update:model-value="setQuizType" /></div>
          <div class="grid grid-cols-2 gap-3">
            <div><Label class="mb-1.5 block">Points</Label><Input v-model="qEdit.points" type="number" min="1" /></div>
            <div><Label class="mb-1.5 block">Difficulty</Label><Select v-model="qEdit.difficulty" :options="[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]" /></div>
          </div>
        </div>
        <div><Label class="mb-1.5 block">Prompt</Label><Textarea v-model="qEdit.prompt" rows="2" /></div>

        <div v-if="isChoice">
          <Label class="mb-1.5 block">Options <span class="text-muted-foreground">(tick the correct {{ singleAnswer ? 'one' : 'ones' }})</span></Label>
          <div class="space-y-2">
            <div v-for="(o, oi) in qEdit.options" :key="oi" class="flex items-center gap-2">
              <button type="button" @click="toggleCorrect(oi)"
                :class="['grid h-6 w-6 shrink-0 place-items-center rounded-full border', qEdit.correct_answers.includes(String(oi)) ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-input']">
                <Check class="h-3.5 w-3.5" />
              </button>
              <Input v-model="qEdit.options[oi]" :placeholder="`Option ${oi + 1}`" :disabled="qEdit.type === 'true_false'" />
              <Button v-if="qEdit.type !== 'true_false'" variant="ghost" size="icon" @click="removeOption(oi)"><X class="h-4 w-4" /></Button>
            </div>
          </div>
          <Button v-if="qEdit.type !== 'true_false'" size="sm" variant="ghost" class="mt-2" @click="addOption"><Plus class="h-3.5 w-3.5" /> Add option</Button>
        </div>
        <div v-else>
          <p class="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Short answer & code questions are graded manually in the grading queue.</p>
        </div>

        <div><Label class="mb-1.5 block">Explanation <span class="text-muted-foreground">(optional)</span></Label><Textarea v-model="qEdit.explanation" rows="2" /></div>
      </div>
      <template #footer>
        <Button variant="outline" @click="qOpen = false">Cancel</Button>
        <Button :loading="busy" @click="saveQuestion"><Save class="h-4 w-4" /> Save question</Button>
      </template>
    </Modal>

    <!-- AI generate modal -->
    <Modal v-model:open="genOpen" title="Generate questions with AI" size="lg">
      <div class="space-y-4">
        <div><Label class="mb-1.5 block">Topic</Label><Input v-model="gen.topic" placeholder="e.g. JavaScript closures" /></div>
        <div><Label class="mb-1.5 block">Or paste source material</Label><Textarea v-model="gen.source_text" rows="4" placeholder="Lesson transcript or notes…" /></div>
        <div class="w-32"><Label class="mb-1.5 block">Count</Label><Input v-model="gen.count" type="number" min="1" max="20" /></div>
        <Button :loading="generating" @click="generate"><Sparkles class="h-4 w-4" /> Generate & add to quiz</Button>
        <p v-if="!generating && genResult.length" class="text-sm text-emerald-600">{{ genResult.length }} questions were added to this quiz.</p>
      </div>
      <template #footer><Button @click="genOpen = false; load()">Done</Button></template>
    </Modal>
  </div>
</template>
