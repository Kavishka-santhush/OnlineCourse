<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Skeleton } from '@/components/ui';
import { api } from '@/lib/api.js';

const props = defineProps({ slug: { type: String, required: true } });
const router = useRouter();
const page = ref(null);
const loading = ref(true);

async function load() {
  loading.value = true;
  try { page.value = (await api.get(`/pages/${props.slug}`)).page; }
  catch (e) { if (e.status === 404) router.replace({ name: 'not-found' }); }
  finally { loading.value = false; }
}
onMounted(load);
watch(() => props.slug, load);
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
    <div v-if="loading" class="space-y-4">
      <Skeleton class="h-10 w-2/3" /><Skeleton class="h-4 w-full" /><Skeleton class="h-4 w-full" /><Skeleton class="h-4 w-4/5" />
    </div>
    <template v-else-if="page">
      <h1 class="text-3xl font-extrabold tracking-tight">{{ page.title }}</h1>
      <div class="mt-6 space-y-4 text-[15px] leading-relaxed text-foreground/90" v-html="page.content"></div>
    </template>
  </div>
</template>
