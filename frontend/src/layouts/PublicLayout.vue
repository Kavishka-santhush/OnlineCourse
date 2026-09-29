<script setup>
import { ref, onMounted, watch } from 'vue';
import { Megaphone, X } from 'lucide-vue-next';
import Navbar from '@/components/feature/Navbar.vue';
import Footer from '@/components/feature/Footer.vue';
import { api } from '@/lib/api.js';
import { useAuthStore } from '@/stores/auth.js';
import { useNotificationsStore } from '@/stores/notifications.js';
import { useWishlist } from '@/composables/useWishlist.js';

const auth = useAuthStore();
const notif = useNotificationsStore();
const wish = useWishlist();

const announcement = ref(null);

async function loadAnnouncement() {
  try {
    const res = await api.get('/announcements/active');
    const list = res.announcements || res.data || [];
    announcement.value = Array.isArray(list) ? list[0] || null : null;
  } catch { /* optional */ }
}

// When auth resolves, hydrate the bell + wishlist for signed-in users.
watch(() => auth.isAuthed, (on) => {
  if (on && auth.profile?.id) {
    notif.fetchList();
    notif.startRealtime(auth.profile.id);
    wish.load();
  } else {
    notif.reset();
    wish.reset();
  }
}, { immediate: true });

onMounted(loadAnnouncement);
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <Navbar />

    <div v-if="announcement" class="border-b bg-primary/10 px-4 py-2 text-sm">
      <div class="mx-auto flex max-w-7xl items-center justify-center gap-2 text-center">
        <Megaphone class="h-4 w-4 shrink-0 text-primary" />
        <span class="font-medium">{{ announcement.title }}</span>
        <span v-if="announcement.message" class="hidden text-muted-foreground sm:inline">— {{ announcement.message }}</span>
        <button class="ml-2 rounded p-0.5 hover:bg-primary/20" @click="announcement = null" aria-label="Dismiss"><X class="h-4 w-4" /></button>
      </div>
    </div>

    <main class="flex-1">
      <RouterView v-slot="{ Component }">
        <Transition enter-active-class="transition duration-200" enter-from-class="opacity-0 translate-y-1">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <Footer />
  </div>
</template>
