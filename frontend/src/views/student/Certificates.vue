<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { Award, Download, ShieldCheck } from 'lucide-vue-next';
import { Card, Button, Skeleton } from '@/components/ui';
import EmptyState from '@/components/feature/EmptyState.vue';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';
import { useUiStore } from '@/stores/ui.js';

const ui = useUiStore();
const certs = ref([]);
const loading = ref(true);
const downloading = ref(null);

onMounted(async () => {
  try { certs.value = (await api.get('/certificates/me')).certificates || []; }
  catch (e) { ui.toast.error(e.message || 'Could not load certificates'); }
  finally { loading.value = false; }
});

async function download(c) {
  downloading.value = c.certificate_id;
  try {
    const { url } = await api.get(`/certificates/${c.certificate_id}/download`);
    if (url) window.open(url, '_blank', 'noopener');
    else ui.toast.error('No file available yet');
  } catch (e) { ui.toast.error(e.message || 'Download failed'); }
  finally { downloading.value = null; }
}
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="flex items-center gap-2 text-2xl font-bold"><Award class="h-6 w-6 text-amber-500" /> Certificates</h1>
      <p class="mt-1 text-sm text-muted-foreground">Earned by completing courses to 100%.</p>
    </div>

    <div v-if="loading" class="grid gap-4 md:grid-cols-2">
      <Skeleton v-for="i in 4" :key="i" class="h-40 rounded-xl" />
    </div>

    <div v-else-if="certs.length" class="grid gap-4 md:grid-cols-2">
      <Card v-for="c in certs" :key="c.certificate_id" class="flex flex-col p-5">
        <div class="flex items-start gap-3">
          <div class="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-amber-500/10">
            <Award class="h-6 w-6 text-amber-500" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-semibold leading-tight">{{ c.course_title }}</p>
            <p class="mt-0.5 text-sm text-muted-foreground">Awarded to {{ c.student_name }}</p>
            <p class="text-xs text-muted-foreground">{{ c.instructor_name ? `Instructor: ${c.instructor_name} · ` : '' }}{{ formatDate(c.created_at) }}</p>
          </div>
        </div>
        <div class="mt-4 flex items-center gap-2 border-t pt-3">
          <Button size="sm" :loading="downloading === c.certificate_id" @click="download(c)"><Download class="h-4 w-4" /> Download PDF</Button>
          <RouterLink :to="{ name: 'verify-certificate', params: { id: c.certificate_id } }">
            <Button size="sm" variant="outline"><ShieldCheck class="h-4 w-4" /> Verify</Button>
          </RouterLink>
        </div>
      </Card>
    </div>

    <EmptyState v-else :icon="Award" title="No certificates yet"
      description="Finish a course to 100% and your shareable certificate will appear here." />
  </div>
</template>
