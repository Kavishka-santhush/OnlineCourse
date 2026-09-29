<script setup>
import { ref, onMounted } from 'vue';
import { Megaphone, Plus, Trash2 } from 'lucide-vue-next';
import { Card, Button, Badge, Input, Textarea, Label, Modal, Select, Switch, Skeleton } from '@/components/ui';
import EmptyState from '@/components/feature/EmptyState.vue';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';
import { useAuthStore } from '@/stores/auth.js';
import { useUiStore } from '@/stores/ui.js';

const auth = useAuthStore();
const ui = useUiStore();

const loading = ref(true);
const announcements = ref([]);
const open = ref(false);
const busy = ref(false);
const acting = ref(null);
const form = ref({ title: '', body: '', level: 'info', active: true });

const levelVariant = { info: 'secondary', success: 'success', warning: 'outline', danger: 'destructive' };
const levelOptions = [
  { value: 'info', label: 'Info' },
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'Warning' },
  { value: 'danger', label: 'Danger' },
];

async function load() {
  loading.value = true;
  try { const d = await api.get('/admin/platform-announcements'); announcements.value = d.announcements || []; }
  catch (e) { ui.toast.error(e.message || 'Could not load announcements'); }
  finally { loading.value = false; }
}
onMounted(load);

async function create() {
  if (!form.value.title.trim()) return ui.toast.error('Title is required');
  busy.value = true;
  try {
    await api.post('/admin/platform-announcements', { title: form.value.title.trim(), body: form.value.body, level: form.value.level, active: form.value.active });
    ui.toast.success('Announcement published');
    open.value = false;
    form.value = { title: '', body: '', level: 'info', active: true };
    await load();
  } catch (e) { ui.toast.error(e.message || 'Failed'); }
  finally { busy.value = false; }
}

async function remove(a) {
  if (!window.confirm('Delete this announcement?')) return;
  acting.value = a.id;
  try { await api.delete(`/admin/platform-announcements/${a.id}`); announcements.value = announcements.value.filter((x) => x.id !== a.id); }
  catch (e) { ui.toast.error(e.message || 'Failed'); }
  finally { acting.value = null; }
}
</script>

<template>
  <div>
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="flex items-center gap-2 text-2xl font-bold"><Megaphone class="h-6 w-6" /> Announcements</h1>
        <p class="mt-1 text-sm text-muted-foreground">Site-wide notices shown to all users.</p>
      </div>
      <Button v-if="auth.isSuperAdmin" @click="open = true"><Plus class="h-4 w-4" /> New announcement</Button>
    </div>

    <p v-if="!auth.isSuperAdmin" class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">Only super admins can create or delete announcements. You have read-only access.</p>

    <div v-if="loading" class="space-y-3"><Skeleton v-for="i in 4" :key="i" class="h-20 rounded-xl" /></div>
    <div v-else-if="announcements.length" class="space-y-3">
      <Card v-for="a in announcements" :key="a.id" class="flex items-start justify-between gap-3 p-4">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <Badge :variant="levelVariant[a.level] || 'muted'">{{ a.level }}</Badge>
            <span class="font-semibold">{{ a.title }}</span>
            <Badge :variant="a.active ? 'success' : 'muted'">{{ a.active ? 'live' : 'hidden' }}</Badge>
          </div>
          <p class="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{{ a.body }}</p>
          <p class="mt-1 text-xs text-muted-foreground">{{ formatDate(a.created_at) }}</p>
        </div>
        <Button v-if="auth.isSuperAdmin" variant="ghost" size="icon" class="shrink-0 text-red-600" :disabled="acting === a.id" @click="remove(a)"><Trash2 class="h-4 w-4" /></Button>
      </Card>
    </div>
    <EmptyState v-else :icon="Megaphone" title="No announcements" description="Publish a notice to appear across the platform." />

    <Modal v-model:open="open" title="New announcement">
      <div class="space-y-4">
        <div><Label class="mb-1.5 block">Title</Label><Input v-model="form.title" maxlength="160" placeholder="Scheduled maintenance" /></div>
        <div><Label class="mb-1.5 block">Message</Label><Textarea v-model="form.body" rows="4" maxlength="4000" /></div>
        <div class="grid grid-cols-2 items-end gap-3">
          <div><Label class="mb-1.5 block">Level</Label><Select v-model="form.level" :options="levelOptions" /></div>
          <label class="flex items-center gap-2 pb-2 text-sm"><Switch v-model="form.active" /> Show immediately</label>
        </div>
      </div>
      <template #footer>
        <Button variant="outline" @click="open = false">Cancel</Button>
        <Button :loading="busy" @click="create">Publish</Button>
      </template>
    </Modal>
  </div>
</template>
