<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

const props = defineProps({
  src: { type: String, required: true },
  poster: { type: String, default: '' },
  type: { type: String, default: 'video/mp4' },
  startTime: { type: Number, default: 0 },
  autoplay: { type: Boolean, default: false },
});
const emit = defineEmits(['timeupdate', 'ended', 'progress']);

const el = ref(null);
let player = null;
let lastReport = 0;

function onTimeUpdate() {
  if (!player) return;
  const t = player.currentTime();
  const d = player.duration() || 0;
  emit('timeupdate', { currentTime: t, duration: d });
  if (d) {
    const pct = Math.round((t / d) * 100);
    if (pct >= 90) emit('progress', pct);
  }
  // Heartbeat every ~15s for study-time tracking.
  if (t - lastReport >= 15) { lastReport = t; }
}

onMounted(() => {
  player = videojs(el.value, {
    controls: true,
    fluid: true,
    preload: 'metadata',
    autoplay: props.autoplay,
    poster: props.poster,
    sources: [{ src: props.src, type: props.type }],
  });
  player.on('timeupdate', onTimeUpdate);
  player.on('ended', () => { emit('progress', 100); emit('ended'); });
  if (props.startTime) player.ready(() => { try { player.currentTime(props.startTime); } catch { /* noop */ } });
});

watch(() => props.src, (src) => {
  if (!player || !src) return;
  player.src({ src, type: props.type });
  player.play?.();
});

onBeforeUnmount(() => { if (player) { player.dispose(); player = null; } });

/** Restore playback position from the outside (e.g. resuming a lesson). */
function seek(seconds) { if (player) player.currentTime(seconds); }
defineExpose({ seek, player: () => player });
</script>

<template>
  <div class="w-full">
    <video ref="el" class="video-js vjs-big-play-centered" playsinline></video>
  </div>
</template>
