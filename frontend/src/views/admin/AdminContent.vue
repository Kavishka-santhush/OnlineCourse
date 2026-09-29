<script setup>
import { ref, onMounted } from 'vue';
import { FileText, Plus, Trash2, Layers, HelpCircle, Megaphone } from 'lucide-vue-next';
import { Card, Button, Badge, Input, Textarea, Label, Tabs, Modal, Select, Switch, Skeleton } from '@/components/ui';
import EmptyState from '@/components/feature/EmptyState.vue';
import { api } from '@/lib/api.js';
import { useUiStore } from '@/stores/ui.js';

const ui = useUiStore();
const tab = ref('categories');
const acting = ref(null);

// ── categories ───────────────────────────────────────────
const catsLoading = ref(true);
const categories = ref([]);
const catOpen = ref(false);
const catForm = ref({ name: '', parent_id: '', icon: '', sort_order: 0 });
const catBusy = ref(false);

async function loadCats() {
  catsLoading.value = true;
  try { const d = await api.get('/categories'); categories.value = d.categories || []; }
  catch (e) { ui.toast.error(e.message || 'Could not load categories'); }
  finally { catsLoading.value = false; }
}
onMounted(loadCats);

const parentOptions = ref([]);
function refreshParentOptions() {
  parentOptions.value = [{ value: '', label: 'Top-level' }, ...categories.value.map((c) => ({ value: c.id, label: c.name }))];
}

async function createCat() {
  if (!catForm.value.name.trim()) return ui.toast.error('Name is required');
  catBusy.value = true;
  try {
    await api.post('/admin/categories', {
      name: catForm.value.name.trim(),
      parent_id: catForm.value.parent_id || null,
      icon: catForm.value.icon.trim() || null,
      sort_order: Number(catForm.value.sort_order) || 0,
    });
    ui.toast.success('Category added');
    catOpen.value = false;
    catForm.value = { name: '', parent_id: '', icon: '', sort_order: 0 };
    await loadCats(); refreshParentOptions();
  } catch (e) { ui.toast.error(e.message || 'Failed'); }
  finally { catBusy.value = false; }
}

async function removeCat(c) {
  if (!window.confirm(`Delete category "${c.name}"?`)) return;
  acting.value = c.id;
  try { await api.delete(`/admin/categories/${c.id}`); ui.toast.success('Deleted'); await loadCats(); refreshParentOptions(); }
  catch (e) { ui.toast.error(e.message || 'Failed'); }
  finally { acting.value = null; }
}

// ── pages ────────────────────────────────────────────────
const pageForm = ref({ slug: 'about', title: 'About us', content: '' });
const pageBusy = ref(false);
async function savePage() {
  if (!pageForm.value.slug.trim() || !pageForm.value.title.trim()) return ui.toast.error('Slug and title required');
  pageBusy.value = true;
  try { await api.post('/admin/pages', pageForm.value); ui.toast.success('Page saved'); }
  catch (e) { ui.toast.error(e.message || 'Failed'); }
  finally { pageBusy.value = false; }
}

// ── faqs ─────────────────────────────────────────────────
const faqsLoading = ref(false);
const faqs = ref([]);
const faqOpen = ref(false);
const faqForm = ref({ question: '', answer: '', category: 'general', sort_order: 0 });
const faqBusy = ref(false);

async function loadFaqs() {
  faqsLoading.value = true;
  try { const d = await api.get('/faqs'); faqs.value = d.faqs || []; }
  catch (e) { ui.toast.error(e.message || 'Could not load FAQs'); }
  finally { faqsLoading.value = false; }
}

async function createFaq() {
  if (!faqForm.value.question.trim() || !faqForm.value.answer.trim()) return ui.toast.error('Question and answer required');
  faqBusy.value = true;
  try {
    await api.post('/admin/faqs', { ...faqForm.value, sort_order: Number(faqForm.value.sort_order) || 0 });
    ui.toast.success('FAQ added'); faqOpen.value = false;
    faqForm.value = { question: '', answer: '', category: 'general', sort_order: 0 };
    await loadFaqs();
  } catch (e) { ui.toast.error(e.message || 'Failed'); }
  finally { faqBusy.value = false; }
}

async function removeFaq(f) {
  acting.value = f.id;
  try { await api.delete(`/admin/faqs/${f.id}`); faqs.value = faqs.value.filter((x) => x.id !== f.id); }
  catch (e) { ui.toast.error(e.message || 'Failed'); }
  finally { acting.value = null; }
}

// ── blog ─────────────────────────────────────────────────
const postsLoading = ref(false);
const posts = ref([]);
const postOpen = ref(false);
const postForm = ref({ title: '', excerpt: '', body: '', is_published: false });
const postBusy = ref(false);

async function loadPosts() {
  postsLoading.value = true;
  try { const d = await api.get('/blog?limit=50'); posts.value = d.posts || []; }
  catch (e) { ui.toast.error(e.message || 'Could not load posts'); }
  finally { postsLoading.value = false; }
}

async function createPost() {
  if (!postForm.value.title.trim() || !postForm.value.body.trim()) return ui.toast.error('Title and body required');
  postBusy.value = true;
  try {
    await api.post('/blog', postForm.value);
    ui.toast.success('Post created'); postOpen.value = false;
    postForm.value = { title: '', excerpt: '', body: '', is_published: false };
    await loadPosts();
  } catch (e) { ui.toast.error(e.message || 'Failed'); }
  finally { postBusy.value = false; }
}

async function togglePublish(p) {
  acting.value = p.id;
  try { await api.patch(`/blog/${p.id}`, { is_published: !p.is_published }); p.is_published = !p.is_published; }
  catch (e) { ui.toast.error(e.message || 'Failed'); }
  finally { acting.value = null; }
}

async function removePost(p) {
  if (!window.confirm(`Delete "${p.title}"?`)) return;
  acting.value = p.id;
  try { await api.delete(`/blog/${p.id}`); posts.value = posts.value.filter((x) => x.id !== p.id); }
  catch (e) { ui.toast.error(e.message || 'Failed'); }
  finally { acting.value = null; }
}

function onTab(v) {
  tab.value = v;
  if (v === 'faqs' && !faqs.value.length) loadFaqs();
  if (v === 'blog' && !posts.value.length) loadPosts();
}
onMounted(refreshParentOptions);
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="flex items-center gap-2 text-2xl font-bold"><FileText class="h-6 w-6" /> Content</h1>
      <p class="mt-1 text-sm text-muted-foreground">Categories, static pages, FAQs and the blog.</p>
    </div>

    <Tabs :model-value="tab" :tabs="[{ value: 'categories', label: 'Categories' }, { value: 'pages', label: 'Pages' }, { value: 'faqs', label: 'FAQs' }, { value: 'blog', label: 'Blog' }]" class="mb-5" @update:model-value="onTab" />

    <!-- Categories -->
    <div v-if="tab === 'categories'">
      <div class="mb-4 flex justify-end"><Button @click="catOpen = true"><Plus class="h-4 w-4" /> Add category</Button></div>
      <div v-if="catsLoading" class="space-y-2"><Skeleton v-for="i in 5" :key="i" class="h-16 rounded-lg" /></div>
      <div v-else-if="categories.length" class="space-y-3">
        <Card v-for="c in categories" :key="c.id" class="p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 font-semibold"><Layers class="h-4 w-4 text-primary" /> {{ c.name }}</div>
            <Button variant="ghost" size="icon" class="text-red-600" :disabled="acting === c.id" @click="removeCat(c)"><Trash2 class="h-4 w-4" /></Button>
          </div>
          <div v-if="c.subcategories?.length" class="mt-2 flex flex-wrap gap-1.5">
            <Badge v-for="s in c.subcategories" :key="s.id" variant="secondary">{{ s.name }}</Badge>
          </div>
        </Card>
      </div>
      <EmptyState v-else :icon="Layers" title="No categories" description="Add a category to organise the catalogue." />
    </div>

    <!-- Pages -->
    <div v-else-if="tab === 'pages'">
      <Card class="max-w-2xl space-y-4 p-5">
        <p class="text-sm text-muted-foreground">Create or update a static CMS page (e.g. <code>/about</code>, <code>/contact</code>). The slug is the URL path.</p>
        <div class="grid grid-cols-2 gap-3">
          <div><Label class="mb-1.5 block">Slug</Label><Input v-model="pageForm.slug" placeholder="about" /></div>
          <div><Label class="mb-1.5 block">Title</Label><Input v-model="pageForm.title" placeholder="About us" /></div>
        </div>
        <div><Label class="mb-1.5 block">Content</Label><Textarea v-model="pageForm.content" rows="10" placeholder="Page body (Markdown or HTML)…" /></div>
        <div class="flex justify-end"><Button :loading="pageBusy" @click="savePage">Save page</Button></div>
      </Card>
    </div>

    <!-- FAQs -->
    <div v-else-if="tab === 'faqs'">
      <div class="mb-4 flex justify-end"><Button @click="faqOpen = true"><Plus class="h-4 w-4" /> Add FAQ</Button></div>
      <div v-if="faqsLoading" class="space-y-2"><Skeleton v-for="i in 4" :key="i" class="h-16 rounded-lg" /></div>
      <div v-else-if="faqs.length" class="space-y-2">
        <Card v-for="f in faqs" :key="f.id" class="flex items-start justify-between gap-3 p-4">
          <div class="min-w-0">
            <div class="flex items-center gap-2"><Badge variant="muted">{{ f.category }}</Badge><span class="font-medium">{{ f.question }}</span></div>
            <p class="mt-1 text-sm text-muted-foreground">{{ f.answer }}</p>
          </div>
          <Button variant="ghost" size="icon" class="shrink-0 text-red-600" :disabled="acting === f.id" @click="removeFaq(f)"><Trash2 class="h-4 w-4" /></Button>
        </Card>
      </div>
      <EmptyState v-else :icon="HelpCircle" title="No FAQs" description="Add frequently asked questions." />
    </div>

    <!-- Blog -->
    <div v-else>
      <div class="mb-4 flex justify-end"><Button @click="postOpen = true"><Plus class="h-4 w-4" /> New post</Button></div>
      <div v-if="postsLoading" class="space-y-2"><Skeleton v-for="i in 4" :key="i" class="h-16 rounded-lg" /></div>
      <div v-else-if="posts.length" class="space-y-2">
        <Card v-for="p in posts" :key="p.id" class="flex items-center justify-between gap-3 p-4">
          <div class="min-w-0">
            <div class="flex items-center gap-2"><span class="truncate font-medium">{{ p.title }}</span><Badge :variant="p.is_published ? 'success' : 'muted'">{{ p.is_published ? 'published' : 'draft' }}</Badge></div>
            <p class="truncate text-xs text-muted-foreground">{{ p.author?.display_name }}</p>
          </div>
          <div class="flex shrink-0 gap-1">
            <Button variant="outline" size="sm" :disabled="acting === p.id" @click="togglePublish(p)">{{ p.is_published ? 'Unpublish' : 'Publish' }}</Button>
            <Button variant="ghost" size="icon" class="text-red-600" :disabled="acting === p.id" @click="removePost(p)"><Trash2 class="h-4 w-4" /></Button>
          </div>
        </Card>
      </div>
      <EmptyState v-else :icon="Megaphone" title="No posts" description="Publish an article to the resource centre." />
    </div>

    <!-- Category modal -->
    <Modal v-model:open="catOpen" title="Add category">
      <div class="space-y-4">
        <div><Label class="mb-1.5 block">Name</Label><Input v-model="catForm.name" placeholder="Web Development" /></div>
        <div><Label class="mb-1.5 block">Parent</Label><Select v-model="catForm.parent_id" :options="parentOptions" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><Label class="mb-1.5 block">Icon (emoji)</Label><Input v-model="catForm.icon" placeholder="💻" /></div>
          <div><Label class="mb-1.5 block">Sort order</Label><Input v-model="catForm.sort_order" type="number" /></div>
        </div>
      </div>
      <template #footer>
        <Button variant="outline" @click="catOpen = false">Cancel</Button>
        <Button :loading="catBusy" @click="createCat">Add</Button>
      </template>
    </Modal>

    <!-- FAQ modal -->
    <Modal v-model:open="faqOpen" title="Add FAQ">
      <div class="space-y-4">
        <div><Label class="mb-1.5 block">Question</Label><Input v-model="faqForm.question" /></div>
        <div><Label class="mb-1.5 block">Answer</Label><Textarea v-model="faqForm.answer" rows="4" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><Label class="mb-1.5 block">Category</Label><Input v-model="faqForm.category" placeholder="general" /></div>
          <div><Label class="mb-1.5 block">Sort order</Label><Input v-model="faqForm.sort_order" type="number" /></div>
        </div>
      </div>
      <template #footer>
        <Button variant="outline" @click="faqOpen = false">Cancel</Button>
        <Button :loading="faqBusy" @click="createFaq">Add</Button>
      </template>
    </Modal>

    <!-- Post modal -->
    <Modal v-model:open="postOpen" title="New blog post" size="lg">
      <div class="space-y-4">
        <div><Label class="mb-1.5 block">Title</Label><Input v-model="postForm.title" /></div>
        <div><Label class="mb-1.5 block">Excerpt</Label><Input v-model="postForm.excerpt" /></div>
        <div><Label class="mb-1.5 block">Body</Label><Textarea v-model="postForm.body" rows="8" /></div>
        <label class="flex items-center gap-2 text-sm"><Switch v-model="postForm.is_published" /> Publish immediately</label>
      </div>
      <template #footer>
        <Button variant="outline" @click="postOpen = false">Cancel</Button>
        <Button :loading="postBusy" @click="createPost">Create</Button>
      </template>
    </Modal>
  </div>
</template>
