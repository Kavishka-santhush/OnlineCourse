<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { CheckCircle2, Clock, Loader2, Award } from 'lucide-vue-next';
import { Button, Card, Textarea, Progress, Badge } from '@/components/ui';
import { api } from '@/lib/api.js';
import { useUiStore } from '@/stores/ui.js';

const props = defineProps({
  id: { type: String, required: true },
  embedded: { type: Boolean, default: false },
});
const ui = useUiStore();

const loading = ref(true);
const quiz = ref(null);
const questions = ref([]);
const attempt = ref(null);
const answers = ref({});          // { questionId: value | [values] | string }
const submitting = ref(false);
const result = ref(null);         // { autoScore, possible, passed }
const secsLeft = ref(0);
let timer = null;

const timed = computed(() => quiz.value?.time_limit_minutes > 0);

async function start() {
  loading.value = true;
  try {
    const res = await api.post(`/quizzes/${props.id}/attempt/start`);
    attempt.value = res.attempt;
    quiz.value = { time_limit_minutes: res.quiz?.time_limit_minutes || 0 };
    questions.value = res.questions || [];
    for (const q of questions.value) answers.value[q.id] = q.type === 'multiple_select' ? [] : (q.type === 'short_answer' || q.type === 'code' ? '' : null);
    const qz = await api.get(`/quizzes/${props.id}`);
    quiz.value = qz.quiz;
    if (qz.quiz.time_limit_minutes > 0) {
      secsLeft.value = qz.quiz.time_limit_minutes * 60;
      timer = setInterval(() => { if (--secsLeft.value <= 0) { clearInterval(timer); submit(); } }, 1000);
    }
  } catch (e) {
    ui.toast.error(e.message || 'Could not start the quiz');
  } finally { loading.value = false; }
}

const mmss = computed(() => {
  const m = Math.floor(secsLeft.value / 60), s = secsLeft.value % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
});
const answeredCount = computed(() => questions.value.filter((q) => {
  const a = answers.value[q.id];
  return Array.isArray(a) ? a.length > 0 : (a !== null && a !== '' && a !== undefined);
}).length);

function toggleMulti(qid, idx) {
  const arr = answers.value[qid];
  answers.value[qid] = arr.includes(idx) ? arr.filter((x) => x !== idx) : [...arr, idx];
}

async function submit() {
  if (!attempt.value || submitting.value) return;
  submitting.value = true;
  try {
    const res = await api.post(`/quizzes/${props.id}/attempt/submit`, { attempt_id: attempt.value.id, answers: answers.value });
    result.value = res.summary;
    if (timer) clearInterval(timer);
  } catch (e) { ui.toast.error(e.message || 'Submit failed'); }
  finally { submitting.value = false; }
}

onMounted(start);
onBeforeUnmount(() => { if (timer) clearInterval(timer); });
</script>

<template>
  <div :class="embedded ? '' : 'mx-auto max-w-3xl px-4 py-8'">
    <!-- result -->
    <Card v-if="result" class="p-8 text-center">
      <Award class="mx-auto h-12 w-12" :class="result.passed ? 'text-emerald-500' : 'text-amber-500'" />
      <h2 class="mt-3 text-2xl font-bold">{{ result.passed ? 'You passed!' : 'Keep practicing' }}</h2>
      <p class="mt-1 text-muted-foreground">Score: <span class="font-semibold text-foreground">{{ result.autoScore }}%</span></p>
      <Progress :model-value="result.autoScore" class="mx-auto mt-4 max-w-xs" :color="result.passed ? 'bg-emerald-500' : 'bg-amber-500'" />
      <p v-if="result.passed === null" class="mt-3 text-sm text-muted-foreground">Some questions need instructor review — final grade coming soon.</p>
      <Button v-if="!embedded" class="mt-6" @click="$router.back()">Back to course</Button>
    </Card>

    <!-- loading -->
    <div v-else-if="loading" class="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 class="mr-2 h-5 w-5 animate-spin" /> Preparing your quiz…
    </div>

    <!-- quiz -->
    <div v-else-if="questions.length">
      <div class="mb-4 flex items-center justify-between">
        <div v-if="!embedded"><h1 class="text-lg font-bold">{{ quiz?.title }}</h1><p class="text-sm text-muted-foreground">{{ quiz?.instructions }}</p></div>
        <div v-else class="flex-1" />
        <div class="flex items-center gap-3">
          <Badge v-if="timed" variant="outline" class="gap-1"><Clock class="h-3.5 w-3.5" /> {{ mmss }}</Badge>
          <Badge variant="muted">{{ answeredCount }}/{{ questions.length }} answered</Badge>
        </div>
      </div>

      <div class="space-y-5">
        <div v-for="(q, qi) in questions" :key="q.id" class="rounded-xl border bg-card p-5">
          <p class="font-medium"><span class="text-muted-foreground">Q{{ qi + 1 }}.</span> {{ q.prompt }}</p>

          <!-- choices -->
          <div v-if="['multiple_choice', 'true_false'].includes(q.type)" class="mt-3 space-y-2">
            <label v-for="(opt, oi) in q.options" :key="oi"
              class="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition hover:bg-accent"
              :class="answers[q.id] === oi ? 'border-primary bg-primary/5' : ''">
              <input type="radio" :name="q.id" :checked="answers[q.id] === oi" @change="answers[q.id] = oi" class="h-4 w-4" />
              {{ opt }}
            </label>
          </div>

          <!-- multi select -->
          <div v-else-if="q.type === 'multiple_select'" class="mt-3 space-y-2">
            <label v-for="(opt, oi) in q.options" :key="oi"
              class="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition hover:bg-accent"
              :class="answers[q.id]?.includes(oi) ? 'border-primary bg-primary/5' : ''">
              <input type="checkbox" :checked="answers[q.id]?.includes(oi)" @change="toggleMulti(q.id, oi)" class="h-4 w-4" />
              {{ opt }}
            </label>
          </div>

          <!-- text/code -->
          <div v-else class="mt-3">
            <Textarea v-model="answers[q.id]" :rows="q.type === 'code' ? 8 : 3" :class="q.type === 'code' ? 'font-mono text-xs' : ''" placeholder="Type your answer…" />
          </div>
        </div>
      </div>

      <div class="mt-6 flex items-center justify-between">
        <p class="text-sm text-muted-foreground">Answered {{ answeredCount }} of {{ questions.length }}</p>
        <Button :loading="submitting" @click="submit"><CheckCircle2 class="h-4 w-4" /> Submit quiz</Button>
      </div>
    </div>

    <p v-else class="py-8 text-center text-sm text-muted-foreground">This quiz has no questions yet.</p>
  </div>
</template>
