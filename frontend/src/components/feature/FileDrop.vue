<script setup>
import { ref } from 'vue';
import { UploadCloud, CheckCircle2, X } from 'lucide-vue-next';
import { Progress } from '@/components/ui';
import { uploadFile } from '@/lib/upload.js';
import { useUiStore } from '@/stores/ui.js';

const props = defineProps({
  bucket: { type: String, default: 'files' },   // videos|files|media|avatars|docs
  folder: { type: String, default: '' },
  accept: { type: String, default: '' },
  label: { type: String, default: 'Drag & drop a file, or click to browse' },
  multiple: { type: Boolean, default: false },
});
const emit = defineEmits(['uploaded', 'error']);
const ui = useUiStore();

const input = ref(null);
const dragging = ref(false);
const busy = ref(false);
const pct = ref(0);

async function handleFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  busy.value = true; pct.value = 0;
  try {
    for (const f of files) {
      const res = await uploadFile(f, { bucket: props.bucket, folder: props.folder, onProgress: (p) => (pct.value = p) });
      emit('uploaded', { file: f, ...res });
      ui.toast.success(`Uploaded ${f.name}`);
    }
  } catch (e) {
    ui.toast.error(e.message || 'Upload failed');
    emit('error', e);
  } finally {
    busy.value = false; pct.value = 0;
    if (input.value) input.value.value = '';
  }
}

function onDrop(e) {
  dragging.value = false;
  handleFiles(e.dataTransfer.files);
}
</script>

<template>
  <div>
    <div
      :class="[
        'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition',
        dragging ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/60 hover:bg-muted/40',
        busy && 'pointer-events-none opacity-70',
      ]"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
      @click="input?.click()">
      <input ref="input" type="file" :accept="accept" :multiple="multiple" class="hidden" @change="handleFiles($event.target.files)" />
      <CheckCircle2 v-if="!busy && pct === 100" class="mb-2 h-8 w-8 text-emerald-500" />
      <UploadCloud v-else class="mb-2 h-8 w-8 text-muted-foreground" />
      <p class="text-sm font-medium">{{ busy ? 'Uploading…' : label }}</p>
      <p v-if="accept" class="mt-1 text-xs text-muted-foreground">Accepted: {{ accept }}</p>
    </div>

    <div v-if="busy" class="mt-3 flex items-center gap-2">
      <Progress :model-value="pct" class="flex-1" />
      <span class="w-10 text-right text-xs tabular-nums text-muted-foreground">{{ pct }}%</span>
      <button class="text-muted-foreground hover:text-foreground" @click="busy = false"><X class="h-4 w-4" /></button>
    </div>
  </div>
</template>
