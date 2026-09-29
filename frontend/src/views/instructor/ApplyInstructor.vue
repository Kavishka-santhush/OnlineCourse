<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { GraduationCap, CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-vue-next';
import { Card, Button, Input, Textarea, Label, Badge } from '@/components/ui';
import { api } from '@/lib/api.js';
import { useAuthStore } from '@/stores/auth.js';
import { useUiStore } from '@/stores/ui.js';

const auth = useAuthStore();
const ui = useUiStore();
const router = useRouter();

const form = ref({ bio: '', expertiseText: '', experience: '', sample_content_url: '' });
const status = ref(null); // { application, isApproved }
const loading = ref(true);
const submitting = ref(false);

const alreadyInstructor = () => auth.isInstructor;

async function load() {
  loading.value = true;
  try { status.value = await api.get('/instructors/apply/status'); }
  catch { status.value = { application: null, isApproved: false }; }
  finally { loading.value = false; }
}

async function submit() {
  const expertise = form.value.expertiseText.split(',').map((s) => s.trim()).filter(Boolean);
  if (form.value.bio.trim().length < 40) return ui.toast.error('Tell us a bit more (min 40 characters)');
  if (!expertise.length) return ui.toast.error('Add at least one area of expertise');
  submitting.value = true;
  try {
    await api.post('/instructors/apply', {
      bio: form.value.bio, expertise, experience: form.value.experience || undefined,
      sample_content_url: form.value.sample_content_url || undefined,
    });
    ui.toast.success('Application submitted — we’ll be in touch!');
    await load();
  } catch (e) { ui.toast.error(e.message || 'Could not submit application'); }
  finally { submitting.value = false; }
}

onMounted(load);
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <div class="mb-6 flex items-center gap-2">
      <GraduationCap class="h-7 w-7 text-primary" />
      <h1 class="text-2xl font-bold">Become an instructor</h1>
    </div>

    <div v-if="loading" class="flex justify-center py-16"><Loader2 class="h-6 w-6 animate-spin text-muted-foreground" /></div>

    <!-- already approved -->
    <Card v-else-if="alreadyInstructor() || status?.isApproved" class="p-8 text-center">
      <CheckCircle2 class="mx-auto h-12 w-12 text-emerald-500" />
      <h2 class="mt-3 text-xl font-bold">You’re an instructor 🎉</h2>
      <p class="mt-1 text-sm text-muted-foreground">Head to your dashboard to create and manage courses.</p>
      <Button class="mt-5" @click="router.push({ name: 'instructor-dashboard' })">Go to instructor dashboard</Button>
    </Card>

    <!-- pending -->
    <Card v-else-if="status?.application?.status === 'pending'" class="p-8 text-center">
      <Clock class="mx-auto h-12 w-12 text-amber-500" />
      <h2 class="mt-3 text-xl font-bold">Application under review</h2>
      <p class="mt-1 text-sm text-muted-foreground">We’ll email you once our team has reviewed your application.</p>
      <Badge class="mt-4" variant="outline">Submitted {{ new Date(status.application.created_at).toLocaleDateString() }}</Badge>
    </Card>

    <!-- rejected → allow reapply; else form -->
    <template v-else>
      <Card v-if="status?.application?.status === 'rejected'" class="mb-5 border-destructive/30 bg-destructive/5 p-4">
        <div class="flex items-start gap-3">
          <XCircle class="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p class="font-medium text-sm">Your previous application was declined</p>
            <p v-if="status.application.decision_reason" class="mt-1 text-sm text-muted-foreground">{{ status.application.decision_reason }}</p>
          </div>
        </div>
      </Card>

      <Card class="p-6">
        <div class="space-y-4">
          <div>
            <Label class="mb-1.5 block">Your bio <span class="text-muted-foreground">(min 40 characters)</span></Label>
            <Textarea v-model="form.bio" rows="4" placeholder="Share your background, credentials and what makes you a great teacher…" />
          </div>
          <div>
            <Label class="mb-1.5 block">Areas of expertise <span class="text-muted-foreground">(comma separated)</span></Label>
            <Input v-model="form.expertiseText" placeholder="Web development, UX design, Python" />
          </div>
          <div>
            <Label class="mb-1.5 block">Teaching experience</Label>
            <Textarea v-model="form.experience" rows="3" placeholder="Where have you taught or mentored?" />
          </div>
          <div>
            <Label class="mb-1.5 block">Sample content URL <span class="text-muted-foreground">(optional)</span></Label>
            <Input v-model="form.sample_content_url" placeholder="https://youtube.com/… or your portfolio" />
          </div>
        </div>
        <div class="mt-6 flex justify-end">
          <Button :loading="submitting" @click="submit">Submit application</Button>
        </div>
      </Card>
    </template>
  </div>
</template>
