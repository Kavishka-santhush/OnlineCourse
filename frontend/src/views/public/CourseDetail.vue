<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import {
  PlayCircle, Star, Clock, Users, BookOpen, Globe, Award, Infinity as InfinityIcon,
  Check, ChevronDown, Heart, ShoppingCart, ShieldCheck, Pencil, Loader2,
} from 'lucide-vue-next';
import { Button, Badge, Card, Skeleton, Tabs, Progress } from '@/components/ui';
import CourseCard from '@/components/feature/CourseCard.vue';
import StarRating from '@/components/feature/StarRating.vue';
import { api } from '@/lib/api.js';
import { money, duration, compact, cn } from '@/lib/utils.js';
import { useAuthStore } from '@/stores/auth.js';
import { useCartStore } from '@/stores/cart.js';
import { useUiStore } from '@/stores/ui.js';
import { useWishlist } from '@/composables/useWishlist.js';

const props = defineProps({ slug: { type: String, required: true } });
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const cart = useCartStore();
const ui = useUiStore();
const wish = useWishlist();

const loading = ref(true);
const course = ref(null);
const enrolled = ref(false);
const canManage = ref(false);
const reviews = ref([]);
const related = ref([]);
const openSections = ref({});
const tab = ref('overview');
const enrolling = ref(false);

async function load() {
  loading.value = true;
  try {
    const res = await api.get(`/courses/${props.slug}`);
    course.value = res.course;
    enrolled.value = res.enrolled;
    canManage.value = res.canManage;
    // expand all sections by default
    for (const s of res.course.sections || []) openSections.value[s.id] = true;
    // reviews + related (best effort)
    const [rv, rel] = await Promise.allSettled([
      api.get(`/courses/${course.value.id}/reviews`, { params: { limit: 6 } }),
      api.get('/courses', { params: { category: course.value.category_id, limit: 4 } }),
    ]);
    reviews.value = rv.status === 'fulfilled' ? (rv.value.reviews || []) : [];
    related.value = rel.status === 'fulfilled' ? (rel.value.courses || []).filter((c) => c.id !== course.value.id).slice(0, 4) : [];
  } catch (e) {
    if (e.status === 404) router.replace({ name: 'not-found' });
  } finally {
    loading.value = false;
  }
}

const lessonCount = computed(() => (course.value?.sections || []).reduce((n, s) => n + (s.lessons?.length || 0), 0));
const previewable = computed(() => (course.value?.sections || []).flatMap((s) => s.lessons || []).find((l) => l.is_preview));

async function enrollFree() {
  if (!auth.isAuthed) return router.push({ name: 'sign-in', query: { redirect: route.fullPath } });
  enrolling.value = true;
  try {
    await api.post(`/enrollments/free/${course.value.id}`);
    enrolled.value = true;
    ui.toast.success('Enrolled! Happy learning.');
    router.push({ name: 'player', params: { slug: course.value.slug } });
  } catch (e) {
    ui.toast.error(e.message || 'Could not enroll');
  } finally {
    enrolling.value = false;
  }
}

function addToCart() {
  cart.add(course.value);
  ui.toast.success('Added to cart');
}

const isInCart = computed(() => cart.has(course.value?.id));

onMounted(() => { load(); wish.load(); });
watch(() => props.slug, load);
</script>

<template>
  <div>
    <!-- loading skeleton -->
    <div v-if="loading" class="bg-neutral-900 px-4 py-16 text-white">
      <div class="mx-auto max-w-7xl">
        <Skeleton class="h-8 w-2/3 bg-white/10" />
        <Skeleton class="mt-4 h-5 w-1/2 bg-white/10" />
      </div>
    </div>

    <template v-else-if="course">
      <!-- hero (dark) -->
      <section class="bg-neutral-900 text-white">
        <div class="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_380px] lg:py-16 lg:px-8">
          <div class="max-w-2xl">
            <div class="flex flex-wrap gap-2 text-sm">
              <RouterLink v-if="course.category" :to="{ name: 'catalog', query: { category: course.category_id } }" class="text-primary-foreground/80 hover:underline">{{ course.category.name }}</RouterLink>
              <Badge v-if="course.level" variant="secondary">{{ course.level }}</Badge>
              <Badge v-if="course.is_featured" variant="default">Featured</Badge>
            </div>
            <h1 class="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">{{ course.title }}</h1>
            <p v-if="course.subtitle" class="mt-3 text-lg text-white/80">{{ course.subtitle }}</p>

            <div class="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div v-if="course.rating_avg > 0" class="flex items-center gap-2">
                <span class="font-bold text-amber-400">{{ Number(course.rating_avg).toFixed(1) }}</span>
                <StarRating :value="Number(course.rating_avg)" size="sm" />
                <span class="text-white/70">({{ compact(course.rating_count) }} ratings)</span>
              </div>
              <span class="inline-flex items-center gap-1.5 text-white/80"><Users class="h-4 w-4" /> {{ compact(course.enrollment_count) }} students</span>
              <span class="inline-flex items-center gap-1.5 text-white/80"><Clock class="h-4 w-4" /> {{ duration(course.total_duration_seconds) }}</span>
              <span class="inline-flex items-center gap-1.5 text-white/80"><BookOpen class="h-4 w-4" /> {{ lessonCount }} lessons</span>
              <span v-if="course.language" class="inline-flex items-center gap-1.5 text-white/80"><Globe class="h-4 w-4" /> {{ course.language }}</span>
            </div>

            <div v-if="course.instructor" class="mt-5 flex items-center gap-3">
              <RouterLink :to="{ name: 'instructor-profile', params: { id: course.instructor.id } }" class="flex items-center gap-2 hover:underline">
                <img v-if="course.instructor.avatar_url" :src="course.instructor.avatar_url" class="h-10 w-10 rounded-full object-cover" />
                <span class="font-semibold">{{ course.instructor.display_name }}</span>
                <ShieldCheck v-if="course.instructor.is_verified_instructor" class="h-4 w-4 text-primary-foreground/70" />
              </RouterLink>
            </div>
          </div>

          <!-- preview media -->
          <div class="hidden items-center justify-center lg:flex">
            <div class="aspect-video w-full overflow-hidden rounded-xl border bg-black shadow-2xl">
              <img v-if="course.thumbnail_url" :src="course.thumbnail_url" :alt="course.title" class="h-full w-full object-cover opacity-80" />
              <div class="flex h-full items-center justify-center">
                <PlayCircle v-if="previewable" class="h-16 w-16 cursor-pointer text-white/90" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- body -->
      <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div class="lg:grid lg:grid-cols-[1fr_380px] lg:gap-10">
          <div class="min-w-0">
            <Tabs v-model="tab" :tabs="[
              { value: 'overview', label: 'Overview' },
              { value: 'curriculum', label: 'Curriculum' },
              { value: 'reviews', label: `Reviews (${course.review_count || 0})` },
              { value: 'qa', label: 'Q&A' },
            ]" class="mb-8" />

            <!-- OVERVIEW -->
            <div v-show="tab === 'overview'">
              <Card v-if="course.learning_objectives?.length" class="p-6">
                <h2 class="mb-4 text-xl font-bold">What you'll learn</h2>
                <ul class="grid gap-3 sm:grid-cols-2">
                  <li v-for="(o, i) in course.learning_objectives" :key="i" class="flex gap-2 text-sm">
                    <Check class="mt-0.5 h-4 w-4 shrink-0 text-primary" /> <span>{{ o }}</span>
                  </li>
                </ul>
              </Card>

              <div v-if="course.description" class="prose mt-8 max-w-none">
                <h2 class="text-xl font-bold">Description</h2>
                <div class="mt-3 text-sm leading-relaxed text-muted-foreground" v-html="course.description"></div>
              </div>

              <div v-if="course.requirements?.length" class="mt-8">
                <h2 class="text-xl font-bold">Requirements</h2>
                <ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li v-for="(r, i) in course.requirements" :key="i">{{ r }}</li>
                </ul>
              </div>

              <div v-if="course.tags?.length" class="mt-8 flex flex-wrap gap-2">
                <RouterLink v-for="t in course.tags" :key="t" :to="{ name: 'catalog', query: { q: t } }">
                  <Badge variant="outline" class="hover:bg-accent">{{ t }}</Badge>
                </RouterLink>
              </div>
            </div>

            <!-- CURRICULUM -->
            <div v-show="tab === 'curriculum'">
              <div class="mb-4 flex items-center justify-between">
                <h2 class="text-xl font-bold">Course curriculum</h2>
                <span class="text-sm text-muted-foreground">{{ (course.sections || []).length }} sections · {{ lessonCount }} lessons</span>
              </div>
              <div class="space-y-3">
                <div v-for="s in course.sections" :key="s.id" class="overflow-hidden rounded-lg border">
                  <button class="flex w-full items-center justify-between bg-muted/40 px-4 py-3 text-left hover:bg-muted" @click="openSections[s.id] = !openSections[s.id]">
                    <span class="font-semibold">{{ s.title }}</span>
                    <span class="flex items-center gap-3 text-xs text-muted-foreground">
                      {{ s.lessons?.length || 0 }} lessons
                      <ChevronDown class="h-4 w-4 transition" :class="openSections[s.id] ? 'rotate-180' : ''" />
                    </span>
                  </button>
                  <ul v-show="openSections[s.id]" class="divide-y">
                    <li v-for="l in s.lessons" :key="l.id" class="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span class="flex items-center gap-2">
                        <component :is="l.type === 'video' ? PlayCircle : l.type === 'quiz' ? BookOpen : Check" class="h-4 w-4 text-muted-foreground" />
                        {{ l.title }}
                      </span>
                      <span class="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge v-if="l.is_preview" variant="success" class="text-[10px]">Preview</Badge>
                        {{ duration(l.duration_seconds) }}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- REVIEWS -->
            <div v-show="tab === 'reviews'">
              <h2 class="mb-4 text-xl font-bold">Student reviews</h2>
              <div v-if="!reviews.length" class="text-sm text-muted-foreground">No reviews yet.</div>
              <div class="space-y-5">
                <div v-for="r in reviews" :key="r.id" class="border-b pb-5">
                  <div class="flex items-center gap-3">
                    <img v-if="r.user?.avatar_url" :src="r.user.avatar_url" class="h-9 w-9 rounded-full object-cover" />
                    <div>
                      <p class="text-sm font-semibold">{{ r.user?.display_name || 'Student' }}</p>
                      <StarRating :value="r.rating" size="sm" />
                    </div>
                  </div>
                  <p v-if="r.is_verified" class="mt-2 text-xs text-emerald-600">✔ Verified purchase</p>
                  <p class="mt-1 text-sm text-muted-foreground">{{ r.body }}</p>
                </div>
              </div>
            </div>

            <!-- QA -->
            <div v-show="tab === 'qa'">
              <h2 class="mb-4 text-xl font-bold">Questions &amp; answers</h2>
              <p class="text-sm text-muted-foreground">Browse and ask questions from the course community.</p>
              <RouterLink v-if="enrolled || canManage" :to="{ name: 'player', params: { slug: course.slug } }">
                <Button variant="outline" class="mt-4">Open Q&A in the course player</Button>
              </RouterLink>
              <p v-else class="mt-4 text-sm text-muted-foreground">Enroll to join the discussion.</p>
            </div>
          </div>

          <!-- purchase card -->
          <aside>
            <div class="sticky top-20">
              <Card class="overflow-hidden">
                <div class="aspect-video bg-black">
                  <img v-if="course.thumbnail_url" :src="course.thumbnail_url" class="h-full w-full object-cover" />
                </div>
                <div class="p-6">
                  <div class="flex items-baseline gap-2">
                    <span class="text-3xl font-extrabold">{{ course.is_free ? 'Free' : money(course.price, course.currency) }}</span>
                  </div>

                  <template v-if="enrolled">
                    <Button class="mt-4 w-full" size="lg" :to="{ name: 'player', params: { slug: course.slug } }">Continue learning</Button>
                    <p class="mt-2 text-center text-sm text-emerald-600 inline-flex w-full justify-center gap-1"><Check class="h-4 w-4" /> You own this course</p>
                  </template>
                  <template v-else-if="canManage">
                    <Button class="mt-4 w-full" size="lg" :to="{ name: 'course-edit', params: { id: course.id } }"><Pencil class="h-4 w-4" /> Edit course</Button>
                  </template>
                  <template v-else-if="course.is_free">
                    <Button class="mt-4 w-full" size="lg" :loading="enrolling" @click="enrollFree">Enroll for free</Button>
                  </template>
                  <template v-else>
                    <Button class="mt-4 w-full" size="lg" :to="{ name: 'checkout' }" @click="!isInCart && cart.add(course)">
                      <ShoppingCart v-if="!isInCart" class="h-4 w-4" /> {{ isInCart ? 'Go to checkout' : 'Add to cart' }}
                    </Button>
                    <Button variant="outline" class="mt-2 w-full" @click="wish.toggle(course)">
                      <Heart class="h-4 w-4" :class="wish.has(course.id) ? 'fill-red-500 text-red-500' : ''" />
                      {{ wish.has(course.id) ? 'Saved in wishlist' : 'Save to wishlist' }}
                    </Button>
                  </template>

                  <p class="mt-3 text-center text-xs text-muted-foreground">30-day money-back guarantee</p>

                  <ul class="mt-5 space-y-2.5 text-sm">
                    <li class="flex items-center gap-2"><InfinityIcon class="h-4 w-4 text-primary" /> Full lifetime access</li>
                    <li class="flex items-center gap-2"><Clock class="h-4 w-4 text-primary" /> {{ duration(course.total_duration_seconds) }} of content</li>
                    <li class="flex items-center gap-2"><BookOpen class="h-4 w-4 text-primary" /> {{ lessonCount }} lessons</li>
                    <li class="flex items-center gap-2"><Award class="h-4 w-4 text-primary" /> Certificate of completion</li>
                    <li class="flex items-center gap-2"><Globe class="h-4 w-4 text-primary" /> {{ course.language }} · {{ course.caption_language ? 'Captions: ' + course.caption_language : 'No captions' }}</li>
                  </ul>
                </div>
              </Card>
            </div>
          </aside>
        </div>

        <!-- related -->
        <div v-if="related.length" class="mt-14">
          <h2 class="mb-5 text-xl font-bold">More courses in {{ course.category?.name }}</h2>
          <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <CourseCard v-for="c in related" :key="c.id" :course="c" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
