<script setup>
import { onMounted } from 'vue';
import { useRouter, RouterLink, useRoute } from 'vue-router';
import { GraduationCap, Star, Users, Award, ChevronRight } from 'lucide-vue-next';
import { Button } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.js';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const redirect = () => route.query.redirect;

// If already signed in, bounce to the intended destination.
onMounted(() => {
  if (auth.isAuthed) router.replace(redirect() || { name: 'home' });
});

async function go(mode) {
  if (mode === 'in') await auth.signIn();
  else await auth.signUp();
}

// Poll briefly after opening the modal; when the profile resolves, redirect.
function watchAuth() {
  const stop = setInterval(() => {
    if (auth.isAuthed) {
      clearInterval(stop);
      router.replace(redirect() || { name: 'home' });
    }
  }, 500);
  setTimeout(() => clearInterval(stop), 120000);
}
</script>

<template>
  <div class="grid min-h-screen lg:grid-cols-2">
    <!-- form side -->
    <div class="flex flex-col justify-center px-6 py-12 sm:px-12">
      <div class="mx-auto w-full max-w-md">
        <RouterLink to="/" class="mb-10 inline-flex items-center gap-2 font-bold">
          <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><GraduationCap class="h-5 w-5" /></span>
          <span class="text-xl">CourseMarket</span>
        </RouterLink>

        <h1 class="text-3xl font-bold tracking-tight">Welcome back</h1>
        <p class="mt-2 text-muted-foreground">Sign in to continue learning, or create a free account to get started.</p>

        <div class="mt-8 space-y-3">
          <Button class="w-full" size="lg" @click="go('in'); watchAuth()">Sign in</Button>
          <Button variant="outline" class="w-full" size="lg" @click="go('up'); watchAuth()">Create account</Button>
        </div>

        <p class="mt-6 text-center text-xs text-muted-foreground">
          Secured by Clerk. Continue with Google, Facebook or GitHub on the popup.
        </p>

        <div v-if="!auth.ready" class="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> Loading auth…
        </div>
      </div>
    </div>

    <!-- brand side -->
    <div class="relative hidden bg-gradient-to-br from-primary via-primary to-indigo-700 lg:block">
      <div class="absolute inset-0 flex flex-col justify-center px-16 text-white">
        <h2 class="max-w-md text-4xl font-bold leading-tight">Learn from the best. Teach what you know.</h2>
        <p class="mt-4 max-w-md text-white/80">
          A complete marketplace with video lessons, quizzes, live classes, AI tutor,
          certificates and instructor payouts — all in one place.
        </p>
        <ul class="mt-10 space-y-4">
          <li class="flex items-center gap-3"><Star class="h-5 w-5" /> Expert-led, career-focused courses</li>
          <li class="flex items-center gap-3"><Users class="h-5 w-5" /> Join a community of learners</li>
          <li class="flex items-center gap-3"><Award class="h-5 w-5" /> Earn verifiable certificates</li>
        </ul>
        <RouterLink to="/courses" class="mt-10 inline-flex items-center gap-1 font-semibold hover:gap-2 transition-all">
          Explore the catalog <ChevronRight class="h-4 w-4" />
        </RouterLink>
      </div>
    </div>
  </div>
</template>
