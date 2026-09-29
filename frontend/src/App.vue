<script setup>
import { Toaster } from '@/components/ui';
import { useUiStore } from '@/stores/ui.js';
const ui = useUiStore();
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <!-- global progress bar -->
    <div v-if="ui.loading" class="fixed left-0 top-0 z-[999] h-0.5 w-full overflow-hidden">
      <div class="h-full w-1/3 animate-pulse bg-primary" />
    </div>
    <RouterView />
    <Toaster />
  </div>
</template>
