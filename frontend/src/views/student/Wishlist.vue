<script setup>
import { onMounted } from 'vue';
import { Heart } from 'lucide-vue-next';
import { Button } from '@/components/ui';
import CourseCard from '@/components/feature/CourseCard.vue';
import EmptyState from '@/components/feature/EmptyState.vue';
import { useWishlist } from '@/composables/useWishlist.js';

const wish = useWishlist();
onMounted(() => wish.load(true));
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="flex items-center gap-2 text-2xl font-bold"><Heart class="h-6 w-6 fill-red-500 text-red-500" /> Wishlist</h1>
      <p class="mt-1 text-sm text-muted-foreground">{{ wish.count.value }} saved courses</p>
    </div>

    <div v-if="wish.courses.value.length" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <CourseCard v-for="c in wish.courses.value" :key="c.id" :course="c" />
    </div>

    <EmptyState v-else :icon="Heart" title="Nothing saved yet"
      description="Tap the heart on any course to save it here for later.">
      <RouterLink to="/courses"><Button>Browse courses</Button></RouterLink>
    </EmptyState>
  </div>
</template>
