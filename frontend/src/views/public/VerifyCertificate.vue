<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ShieldCheck, ShieldX, Search, Award, User, BookOpen } from 'lucide-vue-next';
import { Button, Input, Card } from '@/components/ui';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';

const props = defineProps({ id: { type: String, default: '' } });
const route = useRoute();
const router = useRouter();

const code = ref(props.id && props.id !== 'demo' ? props.id : '');
const result = ref(null); // { valid, certificate }
const loading = ref(false);
const searched = ref(false);

async function verify(target) {
  const value = (target ?? code.value || '').trim();
  if (!value) return;
  loading.value = true;
  searched.value = true;
  result.value = null;
  try {
    result.value = await api.get(`/certificates/verify/${encodeURIComponent(value)}`);
  } catch (e) {
    result.value = { valid: false };
  } finally {
    loading.value = false;
  }
}

function submit() {
  const value = code.value.trim();
  if (!value) return;
  router.replace({ name: 'verify-certificate', params: { id: value } });
  verify(value);
}

onMounted(() => {
  if (props.id && props.id !== 'demo') verify(props.id);
});
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
    <div class="text-center">
      <ShieldCheck class="mx-auto h-12 w-12 text-primary" />
      <h1 class="mt-3 text-3xl font-extrabold tracking-tight">Verify a certificate</h1>
      <p class="mt-2 text-muted-foreground">Enter the certificate ID to confirm its authenticity.</p>
    </div>

    <form class="mt-8 flex gap-2" @submit.prevent="submit">
      <Input v-model="code" placeholder="e.g. CM-ABCD1234" class="h-12" />
      <Button size="lg" :loading="loading"><Search class="h-4 w-4" /> Verify</Button>
    </form>

    <div v-if="searched && !loading" class="mt-10">
      <!-- valid -->
      <Card v-if="result?.valid" class="overflow-hidden">
        <div class="flex items-center gap-2 bg-emerald-500 px-6 py-3 text-white">
          <ShieldCheck class="h-5 w-5" /> <span class="font-semibold">Valid certificate</span>
        </div>
        <div class="p-6">
          <div class="flex items-start gap-4">
            <Award class="h-10 w-10 text-primary" />
            <div>
              <p class="text-sm text-muted-foreground">This certifies that</p>
              <p class="text-2xl font-bold">{{ result.certificate.student_name }}</p>
              <p class="mt-2 text-sm text-muted-foreground">has successfully completed</p>
              <p class="text-lg font-semibold">{{ result.certificate.course_title }}</p>
            </div>
          </div>
          <dl class="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div><dt class="flex items-center gap-1 text-muted-foreground"><User class="h-4 w-4" /> Instructor</dt><dd class="font-medium">{{ result.certificate.instructor_name || '—' }}</dd></div>
            <div><dt class="flex items-center gap-1 text-muted-foreground"><BookOpen class="h-4 w-4" /> Issued</dt><dd class="font-medium">{{ formatDate(result.certificate.issued_at || result.certificate.created_at) }}</dd></div>
            <div class="col-span-2"><dt class="text-muted-foreground">Certificate ID</dt><dd class="font-mono">{{ result.certificate.certificate_id }}</dd></div>
          </dl>
        </div>
      </Card>

      <!-- invalid -->
      <Card v-else class="overflow-hidden">
        <div class="flex items-center gap-2 bg-red-500 px-6 py-3 text-white">
          <ShieldX class="h-5 w-5" /> <span class="font-semibold">Not found</span>
        </div>
        <div class="p-6 text-sm text-muted-foreground">
          We couldn't find a certificate with that ID. Double-check the code and try again.
        </div>
      </Card>
    </div>
  </div>
</template>
