<script setup>
import { ref, onMounted, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { ArrowLeft, Calendar, User } from 'lucide-vue-next';
import { Skeleton, Avatar } from '@/components/ui';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';

const props = defineProps({ slug: { type: String, required: true } });
const post = ref(null);
const loading = ref(true);

async function load() {
  loading.value = true;
  try { post.value = (await api.get(`/blog/${props.slug}`)).post; }
  finally { loading.value = false; }
}
onMounted(load);
watch(() => props.slug, load);
</script>

<template>
  <article class="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
    <div v-if="loading" class="space-y-4">
      <Skeleton class="h-10 w-3/4" />
      <Skeleton class="h-64 w-full rounded-xl" />
      <Skeleton class="h-4 w-full" /><Skeleton class="h-4 w-5/6" /><Skeleton class="h-4 w-4/6" />
    </div>

    <template v-else-if="post">
      <RouterLink to="/blog" class="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft class="h-4 w-4" /> All posts
      </RouterLink>

      <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">{{ post.title }}</h1>
      <div class="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
        <span class="inline-flex items-center gap-2">
          <Avatar :src="post.author?.avatar_url" :name="post.author?.display_name" size="sm" />
          {{ post.author?.display_name }}
        </span>
        <span class="inline-flex items-center gap-1"><Calendar class="h-4 w-4" /> {{ formatDate(post.published_at) }}</span>
      </div>

      <img v-if="post.cover_image_url" :src="post.cover_image_url" :alt="post.title" class="mt-6 aspect-video w-full rounded-xl object-cover" />

      <div class="mt-8 space-y-4 text-[15px] leading-relaxed text-foreground/90" v-html="post.body"></div>
    </template>

    <p v-else class="py-20 text-center text-muted-foreground">Post not found.</p>
  </article>
</template>
