<script setup>
import { RouterLink } from 'vue-router';
import { Compass } from 'lucide-vue-next';
import { Button } from '@/components/ui';
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
    <Compass class="mb-4 h-16 w-16 text-primary/40" />
    <p class="text-7xl font-black tracking-tight text-primary">404</p>
    <h1 class="mt-2 text-2xl font-bold">Page not found</h1>
    <p class="mt-2 max-w-md text-muted-foreground">
      The page you're looking for doesn't exist or has been moved.
      Let's get you back on track.
    </p>
    <div class="mt-6 flex gap-3">
      <Button to="/">Go home</Button>
      <Button variant="outline" :to="{ name: 'catalog' }">Browse courses</Button>
    </div>
  </div>
</template>
