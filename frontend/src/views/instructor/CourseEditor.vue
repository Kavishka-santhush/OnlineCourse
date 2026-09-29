<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, Save, Loader2, Image as ImageIcon, Video } from 'lucide-vue-next';
import { Card, Button, Input, Textarea, Label, Select, Switch, Tabs } from '@/components/ui';
import FileDrop from '@/components/feature/FileDrop.vue';
import { api } from '@/lib/api.js';
import { useUiStore } from '@/stores/ui.js';

const props = defineProps({ id: { type: String, default: null } });
const router = useRouter();
const ui = useUiStore();

const isEdit = computed(() => !!props.id);
const loading = ref(false);
const saving = ref(false);
const tab = ref('basic');
const categories = ref([]);

const form = ref({
  title: '', subtitle: '', description: '', category_id: '', subcategory_id: '',
  level: 'All Levels', language: 'English', price: 0, is_free: false,
  thumbnail_url: '', intro_video_url: '',
  tagsText: '', objectivesText: '', requirementsText: '',
});

const levelOptions = [
  { value: 'All Levels', label: 'All Levels' },
  { value: 'Beginner', label: 'Beginner' },
  { value: 'Intermediate', label: 'Intermediate' },
  { value: 'Advanced', label: 'Advanced' },
];

const categoryOptions = computed(() => categories.value.map((c) => ({ value: c.id, label: c.name })));
const subcategoryOptions = computed(() => {
  const parent = categories.value.find((c) => c.id === form.value.category_id);
  return (parent?.subcategories || []).map((s) => ({ value: s.id, label: s.name }));
});

watch(() => form.value.category_id, () => { form.value.subcategory_id = ''; });

async function loadCategories() {
  try { categories.value = (await api.get('/categories')).categories || []; } catch { /* noop */ }
}

async function loadCourse() {
  if (!isEdit.value) return;
  loading.value = true;
  try {
    const { course } = await api.get(`/courses/${props.id}`);
    Object.assign(form.value, {
      title: course.title || '', subtitle: course.subtitle || '', description: course.description || '',
      category_id: course.category_id || '', subcategory_id: course.subcategory_id || '',
      level: course.level || 'All Levels', language: course.language || 'English',
      price: course.price || 0, is_free: !!course.is_free,
      thumbnail_url: course.thumbnail_url || '', intro_video_url: course.intro_video_url || '',
      tagsText: (course.tags || []).join(', '),
      objectivesText: (course.learning_objectives || []).join('\n'),
      requirementsText: (course.requirements || []).join('\n'),
    });
  } catch (e) { ui.toast.error(e.message || 'Could not load course'); router.back(); }
  finally { loading.value = false; }
}

function payload() {
  return {
    title: form.value.title.trim(),
    subtitle: form.value.subtitle.trim(),
    description: form.value.description,
    category_id: form.value.category_id || undefined,
    subcategory_id: form.value.subcategory_id || undefined,
    level: form.value.level, language: form.value.language,
    price: form.value.is_free ? 0 : Number(form.value.price) || 0,
    is_free: form.value.is_free,
    thumbnail_url: form.value.thumbnail_url || undefined,
    intro_video_url: form.value.intro_video_url || undefined,
    tags: form.value.tagsText.split(',').map((s) => s.trim()).filter(Boolean),
    learning_objectives: form.value.objectivesText.split('\n').map((s) => s.trim()).filter(Boolean),
    requirements: form.value.requirementsText.split('\n').map((s) => s.trim()).filter(Boolean),
  };
}

async function save() {
  if (form.value.title.trim().length < 3) { tab.value = 'basic'; return ui.toast.error('Title must be at least 3 characters'); }
  saving.value = true;
  try {
    if (isEdit.value) {
      const { course } = await api.patch(`/courses/${props.id}`, payload());
      ui.toast.success('Saved');
      form.value.title = course.title; // slug may have changed
    } else {
      const { course } = await api.post('/courses', payload());
      ui.toast.success('Draft created — now build your curriculum');
      router.replace({ name: 'curriculum', params: { id: course.id } });
      return;
    }
  } catch (e) { ui.toast.error(e.message || 'Could not save'); }
  finally { saving.value = false; }
}

function onThumb({ url }) { form.value.thumbnail_url = url; }
function onIntro({ url }) { form.value.intro_video_url = url; }

onMounted(() => { loadCategories(); loadCourse(); });
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <button class="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" @click="router.back()">
      <ArrowLeft class="h-4 w-4" /> Back
    </button>

    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold">{{ isEdit ? 'Edit course' : 'Create a course' }}</h1>
      <Button :loading="saving" @click="save"><Save class="h-4 w-4" /> {{ isEdit ? 'Save changes' : 'Create draft' }}</Button>
    </div>

    <div v-if="loading" class="flex justify-center py-16"><Loader2 class="h-6 w-6 animate-spin text-muted-foreground" /></div>

    <div v-else>
      <Tabs v-model="tab" class="mb-6" :tabs="[
        { value: 'basic', label: 'Basic info' },
        { value: 'pricing', label: 'Category & pricing' },
        { value: 'content', label: 'Content' },
        { value: 'media', label: 'Media' },
      ]" />

      <!-- basic -->
      <Card v-if="tab === 'basic'" class="space-y-4 p-6">
        <div>
          <Label class="mb-1.5 block">Title</Label>
          <Input v-model="form.title" maxlength="160" placeholder="e.g. The Complete Web Development Bootcamp" />
        </div>
        <div>
          <Label class="mb-1.5 block">Subtitle</Label>
          <Input v-model="form.subtitle" maxlength="250" placeholder="A short, catchy summary" />
        </div>
        <div>
          <Label class="mb-1.5 block">Description</Label>
          <Textarea v-model="form.description" rows="8" placeholder="Explain what students will learn and who it's for…" />
        </div>
      </Card>

      <!-- pricing -->
      <Card v-else-if="tab === 'pricing'" class="space-y-4 p-6">
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <Label class="mb-1.5 block">Category</Label>
            <Select v-model="form.category_id" :options="categoryOptions" placeholder="Select a category" />
          </div>
          <div>
            <Label class="mb-1.5 block">Subcategory</Label>
            <Select v-model="form.subcategory_id" :options="subcategoryOptions" :disabled="!subcategoryOptions.length" placeholder="Optional" />
          </div>
          <div>
            <Label class="mb-1.5 block">Level</Label>
            <Select v-model="form.level" :options="levelOptions" />
          </div>
          <div>
            <Label class="mb-1.5 block">Language</Label>
            <Input v-model="form.language" placeholder="English" />
          </div>
        </div>
        <div class="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p class="font-medium">Free course</p>
            <p class="text-sm text-muted-foreground">Make this course available at no cost.</p>
          </div>
          <Switch v-model="form.is_free" />
        </div>
        <div v-if="!form.is_free">
          <Label class="mb-1.5 block">Price (USD)</Label>
          <Input v-model="form.price" type="number" min="0" step="0.01" class="max-w-[180px]" />
        </div>
      </Card>

      <!-- content -->
      <Card v-else-if="tab === 'content'" class="space-y-5 p-6">
        <div>
          <Label class="mb-1.5 block">Tags <span class="text-muted-foreground">(comma separated)</span></Label>
          <Input v-model="form.tagsText" placeholder="javascript, react, web development" />
        </div>
        <div>
          <Label class="mb-1.5 block">What students will learn <span class="text-muted-foreground">(one per line)</span></Label>
          <Textarea v-model="form.objectivesText" rows="6" placeholder="Build full-stack apps&#10;Deploy to the cloud" />
        </div>
        <div>
          <Label class="mb-1.5 block">Requirements <span class="text-muted-foreground">(one per line)</span></Label>
          <Textarea v-model="form.requirementsText" rows="4" placeholder="Basic HTML/CSS&#10;A computer with internet" />
        </div>
      </Card>

      <!-- media -->
      <Card v-else class="space-y-8 p-6">
        <div>
          <Label class="mb-2 flex items-center gap-2"><ImageIcon class="h-4 w-4" /> Thumbnail</Label>
          <div v-if="form.thumbnail_url" class="mb-3 overflow-hidden rounded-lg border">
            <img :src="form.thumbnail_url" class="aspect-video w-full object-cover" />
          </div>
          <FileDrop bucket="media" :folder="`courses/${props.id || 'draft'}`" accept="image/*" label="Upload a course thumbnail" @uploaded="onThumb" />
        </div>
        <div>
          <Label class="mb-2 flex items-center gap-2"><Video class="h-4 w-4" /> Intro video</Label>
          <Input v-model="form.intro_video_url" placeholder="Or paste an external URL (YouTube/Vimeo)" class="mb-3" />
          <FileDrop bucket="videos" :folder="`courses/${props.id || 'draft'}`" accept="video/*" label="Upload an intro video" @uploaded="onIntro" />
        </div>
      </Card>
    </div>
  </div>
</template>
