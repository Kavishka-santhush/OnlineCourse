<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { Search, ArrowRight, PlayCircle, Sparkles, ShieldCheck, BadgeCheck, TrendingUp } from 'lucide-vue-next';
import { Button, Input, Skeleton, Badge } from '@/components/ui';
import CourseCard from '@/components/feature/CourseCard.vue';
import { api } from '@/lib/api.js';

const router = useRouter();
const q = ref('');
const categories = ref([]);
const featured = ref([]);
const trending = ref([]);
const loading = ref(true);

function search() {
  router.push({ name: 'catalog', query: q.value ? { q: q.value } : {} });
}

onMounted(async () => {
  try {
    const [cats, feat, trend] = await Promise.all([
      api.get('/categories'),
      api.get('/search/featured'),
      api.get('/search/trending'),
    ]);
    categories.value = (cats.categories || []).slice(0, 12);
    featured.value = feat.courses || [];
    trending.value = trend.courses || [];
  } catch (e) {
    // Graceful: hero still renders without data.
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div>
    <!-- hero -->
    <section class="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-background to-background">
      <div class="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24 lg:px-8">
        <div>
          <Badge variant="secondary" class="mb-4 gap-1"><Sparkles class="h-3.5 w-3.5" /> AI-powered learning platform</Badge>
          <h1 class="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Master new skills with <span class="text-primary">expert-led</span> courses
          </h1>
          <p class="mt-4 max-w-lg text-lg text-muted-foreground">
            Video lessons, hands-on quizzes, live classes and verifiable certificates.
            Learn from practitioners and grow your career.
          </p>

          <form class="mt-8 flex max-w-xl gap-2" @submit.prevent="search">
            <div class="relative flex-1">
              <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input v-model="q" placeholder="What do you want to learn?" class="h-12 pl-10" />
            </div>
            <Button size="lg" type="submit">Search</Button>
          </form>

          <div class="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span class="inline-flex items-center gap-1.5"><ShieldCheck class="h-4 w-4 text-primary" /> 30-day money-back</span>
            <span class="inline-flex items-center gap-1.5"><BadgeCheck class="h-4 w-4 text-primary" /> Verified instructors</span>
            <span class="inline-flex items-center gap-1.5"><PlayCircle class="h-4 w-4 text-primary" /> Lifetime access</span>
          </div>
        </div>

        <div class="relative hidden lg:block">
          <div class="grid grid-cols-2 gap-4">
            <div v-for="i in 4" :key="i" class="aspect-video rounded-xl border bg-card shadow-lg"
              :class="i % 2 ? 'translate-y-6' : ''">
              <div class="flex h-full items-center justify-center text-5xl font-black text-primary/20">{{ i }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- categories -->
    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div class="flex items-end justify-between">
        <h2 class="text-2xl font-bold">Browse by category</h2>
        <RouterLink to="/courses" class="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          All courses <ArrowRight class="h-4 w-4" />
        </RouterLink>
      </div>
      <div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <RouterLink v-for="c in categories" :key="c.id" :to="{ name: 'catalog', query: { category: c.id } }"
          class="group rounded-xl border bg-card p-4 transition hover:border-primary/50 hover:shadow-md">
          <div class="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <component :is="TrendingUp" class="h-5 w-5" />
          </div>
          <p class="font-semibold group-hover:text-primary">{{ c.name }}</p>
          <p class="text-xs text-muted-foreground">{{ c.subcategories?.length || 0 }} topics</p>
        </RouterLink>
        <div v-if="!categories.length && loading" v-for="i in 8" :key="'s'+i"><Skeleton class="h-24 w-full" /></div>
      </div>
    </section>

    <!-- featured -->
    <section class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h2 class="text-2xl font-bold">Featured courses</h2>
      <p class="mt-1 text-muted-foreground">Hand-picked by our editorial team.</p>
      <div class="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <CourseCard v-for="c in featured" :key="c.id" :course="c" />
        <template v-if="!featured.length && loading">
          <Skeleton v-for="i in 4" :key="i" class="h-72 w-full rounded-xl" />
        </template>
        <p v-if="!featured.length && !loading" class="col-span-full text-sm text-muted-foreground">No featured courses yet — check back soon.</p>
      </div>
    </section>

    <!-- trending -->
    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div class="flex items-end justify-between">
        <h2 class="text-2xl font-bold">Trending right now</h2>
        <RouterLink to="/courses" class="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          Explore <ArrowRight class="h-4 w-4" />
        </RouterLink>
      </div>
      <div class="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <CourseCard v-for="c in trending.slice(0, 8)" :key="c.id" :course="c" />
        <template v-if="!trending.length && loading">
          <Skeleton v-for="i in 4" :key="i" class="h-72 w-full rounded-xl" />
        </template>
      </div>
    </section>

    <!-- instructor CTA -->
    <section class="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <div class="overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-indigo-600 px-8 py-12 text-white sm:px-12">
        <div class="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h2 class="text-3xl font-bold">Become an instructor</h2>
            <p class="mt-2 max-w-xl text-white/85">
              Share your expertise, reach learners worldwide, and earn up to 80% of every sale
              with transparent payouts and powerful authoring tools.
            </p>
          </div>
          <RouterLink to="/app/apply-instructor">
            <Button size="lg" variant="secondary" class="text-primary">Start teaching <ArrowRight class="h-4 w-4" /></Button>
          </RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>
