<script setup>
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-vue-next';
import { useUiStore } from '@/stores/ui.js';
const ui = useUiStore();
const icons = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle };
const tones = {
  success: 'border-l-emerald-500', error: 'border-l-red-500',
  info: 'border-l-blue-500', warning: 'border-l-amber-500',
};
</script>
<template>
  <div class="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
    <TransitionGroup enter-active-class="transition" enter-from-class="opacity-0 -translate-y-2" leave-active-class="transition" leave-to-class="opacity-0">
      <div v-for="t in ui.toasts" :key="t.id"
        class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-l-4 bg-background p-3 shadow-lg"
        :class="tones[t.type]">
        <component :is="icons[t.type]" class="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div class="min-w-0 flex-1">
          <p v-if="t.title" class="text-sm font-semibold">{{ t.title }}</p>
          <p class="break-words text-sm text-muted-foreground">{{ t.message }}</p>
        </div>
        <button class="text-muted-foreground hover:text-foreground" @click="ui.dismiss(t.id)"><X class="h-4 w-4" /></button>
      </div>
    </TransitionGroup>
  </div>
</template>
