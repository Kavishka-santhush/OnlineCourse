<script setup>
import { ref, onMounted, watch } from 'vue';
import { ShieldCheck, Globe } from 'lucide-vue-next';
import { Card, Skeleton, Avatar } from '@/components/ui';
import CourseCard from '@/components/feature/CourseCard.vue';
import { api } from '@/lib/api.js';
import { compact } from '@/lib/utils.js';

const props = defineProps({ id: { type: String, required: true } });
const loading = ref(true);
const instructor = ref(null);
const courses = ref([]);
const stats = ref({});

async function load() {
  loading.value = true;
  try {
    const res = await api.get(`/instructors/${props.id}/profile`);
    instructor.value = res.instructor;
    courses.value = res.courses || [];
    stats.value = res.stats || {};
  } catch (e) {
    if (e.status === 404) instructor.value = null;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
watch(() => props.id, load);
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div v-if="loading" class="space-y-6">
      <Skeleton class="h-40 w-full rounded-xl" />
      <Skeleton class="h-72 w-full rounded-xl" />
    </div>

    <div v-else-if="!instructor" class="py-20 text-center text-muted-foreground">Instructor not found.</div>

    <template v-else>
      <Card class="overflow-hidden">
        <div class="h-28 bg-gradient-to-r from-primary to-indigo-600" />
        <div class="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end">
          <Avatar :src="instructor.avatar_url" :name="instructor.display_name" size="xl" class="-mt-12 border-4 border-background" />
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <h1 class="text-2xl font-bold">{{ instructor.display_name }}</h1>
              <ShieldCheck v-if="instructor.is_verified_instructor" class="h-5 w-5 text-primary" title="Verified instructor" />
            </div>
            <p v-if="instructor.instructor_tier" class="text-sm text-muted-foreground capitalize">{{ instructor.instructor_tier }} instructor</p>
          </div>
          <div class="flex gap-5 text-center sm:text-right">
            <div><p class="text-xl font-bold">{{ compact(stats.totalStudents) }}</p><p class="text-xs text-muted-foreground">Students</p></div>
            <div><p class="text-xl font-bold">{{ stats.totalCourses || 0 }}</p><p class="text-xs text-muted-foreground">Courses</p></div>
            <div><p class="text-xl font-bold">{{ Number(stats.avgRating || 0).toFixed(1) }}</p><p class="text-xs text-muted-foreground">Rating</p></div>
          </div>
        </div>
        <div v-if="instructor.bio || instructor.website" class="border-t px-6 py-4">
          <p v-if="instructor.bio" class="text-sm text-muted-foreground">{{ instructor.bio }}</p>
          <a v-if="instructor.website" :href="instructor.website" target="_blank" rel="noopener" class="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"><Globe class="h-4 w-4" /> {{ instructor.website }}</a>
        </div>
      </Card>

      <h2 class="mb-5 mt-10 text-xl font-bold">Courses by {{ instructor.display_name }}</h2>
      <div v-if="courses.length" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <CourseCard v-for="c in courses" :key="c.id" :course="c" />
      </div>
      <p v-else class="text-sm text-muted-foreground">No published courses yet.</p>
    </template>
  </div>
</template>
