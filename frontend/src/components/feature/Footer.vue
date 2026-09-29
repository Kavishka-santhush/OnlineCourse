<script setup>
import { RouterLink } from 'vue-router';
import { GraduationCap, Twitter, Github, Linkedin, Youtube } from 'lucide-vue-next';

const columns = [
  { title: 'Platform', links: [
    { label: 'Explore courses', to: '/courses' },
    { label: 'Pricing', to: '/pricing' },
    { label: 'Become an instructor', to: '/app/apply-instructor' },
    { label: 'Blog', to: '/blog' },
  ] },
  { title: 'Resources', links: [
    { label: 'Verify a certificate', to: '/certificates/verify/demo' },
    { label: 'Help center', to: '/p/help-center' },
    { label: 'Community', to: '/p/community' },
    { label: 'Tutorials', to: '/blog' },
  ] },
  { title: 'Company', links: [
    { label: 'About us', to: '/p/about' },
    { label: 'Careers', to: '/p/careers' },
    { label: 'Terms of service', to: '/p/terms' },
    { label: 'Privacy policy', to: '/p/privacy' },
  ] },
];
</script>

<template>
  <footer class="mt-16 border-t bg-muted/30">
    <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="grid grid-cols-2 gap-8 md:grid-cols-5">
        <div class="col-span-2">
          <RouterLink to="/" class="flex items-center gap-2 font-bold">
            <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap class="h-5 w-5" />
            </span>
            <span class="text-lg">CourseMarket</span>
          </RouterLink>
          <p class="mt-3 max-w-xs text-sm text-muted-foreground">
            The enterprise-ready online course marketplace. Learn from expert instructors,
            teach what you know, and grow with a platform built for scale.
          </p>
          <div class="mt-4 flex gap-3 text-muted-foreground">
            <a href="#" class="transition hover:text-foreground" aria-label="Twitter"><Twitter class="h-5 w-5" /></a>
            <a href="#" class="transition hover:text-foreground" aria-label="GitHub"><Github class="h-5 w-5" /></a>
            <a href="#" class="transition hover:text-foreground" aria-label="LinkedIn"><Linkedin class="h-5 w-5" /></a>
            <a href="#" class="transition hover:text-foreground" aria-label="YouTube"><Youtube class="h-5 w-5" /></a>
          </div>
        </div>

        <div v-for="col in columns" :key="col.title">
          <h4 class="text-sm font-semibold">{{ col.title }}</h4>
          <ul class="mt-3 space-y-2">
            <li v-for="l in col.links" :key="l.label">
              <RouterLink :to="l.to" class="text-sm text-muted-foreground transition hover:text-foreground">{{ l.label }}</RouterLink>
            </li>
          </ul>
        </div>
      </div>

      <div class="mt-10 flex flex-col items-center justify-between gap-3 border-t pt-6 text-sm text-muted-foreground sm:flex-row">
        <p>© {{ new Date().getFullYear() }} CourseMarket. All rights reserved.</p>
        <p>Built with Vue 3 · Supabase · Stripe · Clerk</p>
      </div>
    </div>
  </footer>
</template>
