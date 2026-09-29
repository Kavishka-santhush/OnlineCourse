<script setup>
import { ref } from 'vue';
import { onClickOutside } from '@vueuse/core';
import { cn } from '@/lib/utils.js';
const props = defineProps({ align: { type: String, default: 'right' }, class: { type: [String, Array, Object], default: '' } });
const open = ref(false);
const root = ref(null);
onClickOutside(root, () => (open.value = false));
function itemClick() { open.value = false; }
</script>
<template>
  <div ref="root" :class="cn('relative', $props.class)">
    <div @click="open = !open"><slot name="trigger" :toggle="() => (open = !open)" /></div>
    <Transition enter-active-class="transition duration-100" enter-from-class="opacity-0 scale-95" leave-active-class="transition duration-75" leave-to-class="opacity-0 scale-95">
      <div v-if="open" @click="itemClick"
        :class="cn('absolute z-40 mt-2 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg',
          align === 'right' ? 'right-0' : 'left-0')">
        <slot />
      </div>
    </Transition>
  </div>
</template>
