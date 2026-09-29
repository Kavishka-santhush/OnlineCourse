<script setup>
import { computed } from 'vue';
import { Users, Clock, BookOpen, Heart, ShoppingCart, Check, Globe } from 'lucide-vue-next';
import { RouterLink } from 'vue-router';
import { money, duration, compact, cn } from '@/lib/utils.js';
import { Badge } from '@/components/ui';
import StarRating from './StarRating.vue';
import { useCartStore } from '@/stores/cart.js';
import { useWishlist } from '@/composables/useWishlist.js';

const props = defineProps({ course: { type: Object, required: true }, horizontal: { type: Boolean, default: false } });
const cart = useCartStore();
const wish = useWishlist();

const c = computed(() => props.course);
const inCart = computed(() => cart.has(c.value.id));
const wished = computed(() => wish.has(c.value.id));
const enrollments = computed(() => c.value.enrollments?.[0]?.count ?? c.value.enrollment_count ?? 0);
</script>

<template>
  <div :class="cn('group relative overflow-hidden rounded-xl border bg-card shadow-sm transition hover:shadow-md',
    horizontal && 'flex gap-4')">
    <RouterLink :to="{ name: 'course-detail', params: { slug: c.slug } }" class="block">
      <div :class="cn('relative aspect-video overflow-hidden bg-muted', horizontal && 'aspect-[16/10] w-56 shrink-0')">
        <img v-if="c.thumbnail_url" :src="c.thumbnail_url" :alt="c.title" loading="lazy"
          class="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        <div v-else class="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 text-4xl font-black text-primary/40">
          {{ c.title?.[0] }}
        </div>
        <div class="absolute left-2 top-2 flex gap-1">
          <Badge v-if="c.is_free" variant="success">Free</Badge>
          <Badge v-else-if="c.is_featured" variant="default">Featured</Badge>
        </div>
      </div>
    </RouterLink>

    <div :class="cn('flex flex-col p-4', horizontal && 'flex-1 py-4 pr-16')">
      <RouterLink :to="{ name: 'course-detail', params: { slug: c.slug } }">
        <h3 class="line-clamp-2 font-semibold leading-tight hover:text-primary">{{ c.title }}</h3>
      </RouterLink>
      <p v-if="c.instructor_name || c.instructor?.display_name" class="mt-1 truncate text-sm text-muted-foreground">
        {{ c.instructor_name || c.instructor?.display_name }}
      </p>

      <div v-if="c.rating_avg > 0" class="mt-1.5 flex items-center gap-1.5">
        <span class="text-sm font-semibold text-amber-500">{{ Number(c.rating_avg).toFixed(1) }}</span>
        <StarRating :value="Number(c.rating_avg)" size="sm" />
        <span class="text-xs text-muted-foreground">({{ compact(c.rating_count) }})</span>
      </div>

      <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span v-if="c.level" class="inline-flex items-center gap-1"><BookOpen class="h-3.5 w-3.5" />{{ c.level }}</span>
        <span v-if="c.total_duration_seconds" class="inline-flex items-center gap-1"><Clock class="h-3.5 w-3.5" />{{ duration(c.total_duration_seconds) }}</span>
        <span v-if="enrollments" class="inline-flex items-center gap-1"><Users class="h-3.5 w-3.5" />{{ compact(enrollments) }}</span>
        <span v-if="c.language" class="inline-flex items-center gap-1"><Globe class="h-3.5 w-3.5" />{{ c.language }}</span>
      </div>

      <div class="mt-3 flex items-center justify-between pt-1">
        <span class="text-lg font-bold">{{ c.is_free ? 'Free' : money(c.price, c.currency) }}</span>
      </div>
    </div>

    <div class="absolute right-3 top-3 flex flex-col gap-2">
      <button @click="wish.toggle(c)" :title="wished ? 'Remove from wishlist' : 'Save to wishlist'"
        class="rounded-full bg-background/90 p-2 shadow backdrop-blur transition hover:scale-110">
        <Heart class="h-4 w-4" :class="wished ? 'fill-red-500 text-red-500' : 'text-muted-foreground'" />
      </button>
      <button v-if="!c.is_free" @click="inCart ? cart.remove(c.id) : cart.add(c)" :title="inCart ? 'In cart' : 'Add to cart'"
        class="rounded-full bg-background/90 p-2 shadow backdrop-blur transition hover:scale-110">
        <Check v-if="inCart" class="h-4 w-4 text-emerald-600" />
        <ShoppingCart v-else class="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  </div>
</template>
