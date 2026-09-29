<script setup>
import { watch, onMounted, onUnmounted } from 'vue';
import { X } from 'lucide-vue-next';
import { cn } from '@/lib/utils.js';
const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  size: { type: String, default: 'md' }, // sm|md|lg|xl
  class: { type: [String, Array, Object], default: '' },
});
const emit = defineEmits(['update:open', 'close']);
const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
function close() { emit('update:open', false); emit('close'); }
function onKey(e) { if (e.key === 'Escape' && props.open) close(); }
onMounted(() => window.addEventListener('keydown', onKey));
onUnmounted(() => window.removeEventListener('keydown', onKey));
watch(() => props.open, (v) => { document.body.style.overflow = v ? 'hidden' : ''; });
</script>
<template>
  <Teleport to="body">
    <Transition enter-active-class="transition" enter-from-class="opacity-0" leave-active-class="transition" leave-to-class="opacity-0">
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="close" />
        <div :class="cn('relative z-10 w-full rounded-xl border bg-background shadow-xl', sizes[size], $props.class)">
          <div v-if="title || $slots.header" class="flex items-center justify-between border-b px-5 py-3.5">
            <slot name="header"><h3 class="text-base font-semibold">{{ title }}</h3></slot>
            <button class="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" @click="close"><X class="h-4 w-4" /></button>
          </div>
          <div class="px-5 py-4"><slot /></div>
          <div v-if="$slots.footer" class="flex justify-end gap-2 border-t px-5 py-3"><slot name="footer" /></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
