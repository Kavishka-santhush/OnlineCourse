<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { Calendar, User } from 'lucide-vue-next';
import { Card, Skeleton, Badge } from '@/components/ui';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';

const posts = ref([]);
const loading = ref(true);

onMounted(async () => {
  try { posts.value = (await api.get('/blog', { params: { limit: 24 } })).posts || []; }
  finally { loading.value = false; }
});
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
    <div class="mb-10 text-center">
      <h1 class="text-4xl font-extrabold tracking-tight">The CourseMarket Blog</h1>
      <p class="mx-auto mt-3 max-w-xl text-muted-foreground">Tips, tutorials and product news to help you learn and teach better.</p>
    </div>

    <div v-if="loading" class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <Skeleton v-for="i in 6" :key="i" class="h-72 rounded-xl" />
    </div>

    <div v-else-if="posts.length" class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <RouterLink v-for="p in posts" :key="p.id" :to="{ name: 'blog-post', params: { slug: p.slug } }">
        <Card class="group h-full overflow-hidden transition hover:shadow-md">
          <div class="aspect-video overflow-hidden bg-muted">
            <img v-if="p.cover_image_url" :src="p.cover_image_url" :alt="p.title" class="h-full w-full object-cover transition group-hover:scale-105" />
            <div v-else class="flex h-full items-center justify-center text-5xl font-black text-primary/20">{{ p.title?.[0] }}</div>
          </div>
          <div class="p-5">
            <div v-if="p.tags?.length" class="mb-2 flex flex-wrap gap-1">
              <Badge v-for="t in p.tags.slice(0, 2)" :key="t" variant="muted">{{ t }}</Badge>
            </div>
            <h2 class="line-clamp-2 font-bold leading-snug group-hover:text-primary">{{ p.title }}</h2>
            <p class="mt-2 line-clamp-2 text-sm text-muted-foreground">{{ p.excerpt }}</p>
            <div class="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
              <span class="inline-flex items-center gap-1"><User class="h-3.5 w-3.5" /> {{ p.author?.display_name }}</span>
              <span class="inline-flex items-center gap-1"><Calendar class="h-3.5 w-3.5" /> {{ formatDate(p.published_at) }}</span>
            </div>
          </div>
        </Card>
      </RouterLink>
    </div>

    <p v-else class="py-20 text-center text-muted-foreground">No posts yet.</p>
  </div>
</template>
